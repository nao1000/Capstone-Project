from ortools.sat.python import cp_model
from .models import (
    TeamRoleAssignment,
    AvailabilityRange,
    FixedObstruction,
    Room,
    RoomAvailability,
    PreferredTime,
)


def generate_schedule(
    team,
    roles=None,
    target_days=["sun", "mon", "tue", "wed", "thu", "fri"],
    timeout=30.0,
    config=None,
):
    """
    Attempts to generate a full schedule. Falls back gracefully through three phases:

    Phase 1 — Strict solve (original timeout):
        Workers must meet exact weekly_quota. Fails fast if impossible.

    Phase 2 — Extended solve (2x timeout, strict constraints):
        Only runs if Phase 1 timed out (UNKNOWN). Skipped for INFEASIBLE.

    Phase 3 — Partial solve (2x timeout, relaxed quota):
        Runs if Phases 1+2 both failed. Quota becomes an upper bound instead of
        a hard equality. The objective maximises total sessions scheduled first,
        then quality. Returns a list of shortfalls describing what couldn't be filled.

    Returns:
        tuple(list[dict], list[dict]):
            - results:    scheduled shifts (same schema as before)
            - shortfalls: empty list on full success; otherwise one entry per
                          worker/role that was under-quota, e.g.:
                          {"user_name": "Alice", "role_name": "CHEM 151",
                           "assigned": 1, "quota": 3}
    """

    # ------------------------------------------------------------------
    # 1. CONFIG
    # ------------------------------------------------------------------
    if config is None:
        config = {
            "duration": 50,
            "interval": 30,
            "weekly_quota": 3,
            "daily_max": 1,
            "max_concurrent": 1,
        }

    duration      = config.get("duration", 50)
    interval      = config.get("interval", 30)
    weekly_quota  = config.get("weekly_quota", 3)
    daily_max     = config.get("daily_max", 1)
    max_concurrent = config.get("max_concurrent", 1)

    # ------------------------------------------------------------------
    # 2. FETCH DATA
    # ------------------------------------------------------------------
    if roles is None:
        assignments = TeamRoleAssignment.objects.filter(team=team).select_related("role", "user")
    else:
        try:
            iter(roles)
        except TypeError:
            roles = [roles]
        assignments = TeamRoleAssignment.objects.filter(
            team=team, role__in=roles
        ).select_related("role", "user")

    rooms       = list(Room.objects.filter(team=team))
    start_times = list(range(480, 1050, interval))

    worker_roles = {}
    role_workers = {}
    # Also keep a lookup: user_id → display name, role_id → role name (for shortfalls)
    user_name_map = {}
    role_name_map = {}

    for a in assignments:
        w_id = a.user.id
        r_id = a.role.id
        worker_roles.setdefault(w_id, []).append(r_id)
        role_workers.setdefault(r_id, []).append(w_id)
        user_name_map[w_id] = a.user.get_full_name() or a.user.username
        role_name_map[r_id] = a.role.name

    worker_ids     = list(worker_roles.keys())
    active_role_ids = list(role_workers.keys())

    def time_to_mins(tm):
        return tm.hour * 60 + tm.minute

    # ------------------------------------------------------------------
    # 3. PRE-INDEX LOOKUPS
    # ------------------------------------------------------------------
    room_avails   = RoomAvailability.objects.filter(room__in=rooms)
    room_avail_map = {}
    for ra in room_avails:
        room_avail_map.setdefault((ra.room_id, ra.day), []).append(ra)

    busy_times = AvailabilityRange.objects.filter(team=team, user_id__in=worker_ids)
    busy_map   = {}
    for busy in busy_times:
        busy_map.setdefault((busy.user_id, busy.day), []).append(busy)

    fixed_obs = FixedObstruction.objects.filter(
        team=team, role_id__in=active_role_ids
    ).prefetch_related("days")

    preferred_times = PreferredTime.objects.filter(team=team, user_id__in=worker_ids)
    pref_map        = {}
    for pref in preferred_times:
        pref_map.setdefault((pref.user_id, pref.day), []).append(pref)

    # ------------------------------------------------------------------
    # 4. PRE-COMPUTE BLOCKED SLOTS
    # ------------------------------------------------------------------
    blocked = set()

    for (w_id, day), busies in busy_map.items():
        if day not in target_days:
            continue
        for busy in busies:
            b_start = time_to_mins(busy.start_time)
            b_end   = time_to_mins(busy.end_time)
            for t in start_times:
                if t < b_end and (t + duration) > b_start:
                    blocked.add((w_id, day, t))

    for obs in fixed_obs:
        obs_days = [d.day for d in obs.days.all()]
        b_start  = time_to_mins(obs.start_time)
        b_end    = time_to_mins(obs.end_time)
        r_id     = obs.role_id
        for d in obs_days:
            if d not in target_days:
                continue
            for t in start_times:
                if t < b_end and (t + duration) > b_start:
                    for w_id in role_workers.get(r_id, []):
                        blocked.add((w_id, d, t))

    room_blocked = set()
    for d in target_days:
        for t in start_times:
            shift_end  = t + duration
            all_closed = True
            for rm in rooms:
                daily_avails = room_avail_map.get((rm.id, d), [])
                for avail in daily_avails:
                    open_start = time_to_mins(avail.start_time)
                    open_end   = time_to_mins(avail.end_time)
                    if t >= open_start and shift_end <= open_end:
                        all_closed = False
                        break
                if not all_closed:
                    break
            if all_closed:
                room_blocked.add((d, t))

    # ------------------------------------------------------------------
    # 5. SHARED MODEL BUILDER
    # ------------------------------------------------------------------
    def _build_model(partial: bool):
        """
        Constructs the CP-SAT model.

        partial=False → weekly_quota is a hard equality (full schedule).
        partial=True  → weekly_quota is an upper bound; objective is
                        (sessions assigned × large weight) + quality score,
                        so the solver fills as many slots as possible first.
        """
        model  = cp_model.CpModel()
        shifts = {}

        # --- Variables ---
        for d in target_days:
            for t in start_times:
                if (d, t) in room_blocked:
                    continue
                for rm in rooms:
                    shift_end    = t + duration
                    daily_avails = room_avail_map.get((rm.id, d), [])
                    room_open    = any(
                        time_to_mins(avail.start_time) <= t
                        and shift_end <= time_to_mins(avail.end_time)
                        for avail in daily_avails
                    )
                    if not room_open:
                        continue
                    for w_id, r_ids in worker_roles.items():
                        if (w_id, d, t) in blocked:
                            continue
                        for r_id in r_ids:
                            shifts[(d, t, rm.id, w_id, r_id)] = model.NewBoolVar(
                                f"shift_{d}_{t}_{rm.id}_{w_id}_{r_id}"
                            )

        # --- Constraint A: Quota ---
        for w_id, r_ids in worker_roles.items():
            for r_id in r_ids:
                shift_sum = sum(
                    shifts[(d, t, rm.id, w_id, r_id)]
                    for d in target_days
                    for t in start_times
                    for rm in rooms
                    if (d, t, rm.id, w_id, r_id) in shifts
                )
                if partial:
                    model.Add(shift_sum <= weekly_quota)   # relaxed: fill what you can
                else:
                    model.Add(shift_sum == weekly_quota)   # strict: must hit quota

            # Daily cap always stays as an upper bound
            for d in target_days:
                model.Add(
                    sum(
                        shifts[(d, t, rm.id, w_id, r_id)]
                        for t in start_times
                        for rm in rooms
                        for r_id in r_ids
                        if (d, t, rm.id, w_id, r_id) in shifts
                    ) <= daily_max
                )

        # --- Constraint B: No double-booking + room capacity ---
        for d in target_days:
            for i, t in enumerate(start_times):
                for w_id, r_ids in worker_roles.items():
                    active_for_worker = [
                        shifts[(d, t, rm.id, w_id, r_id)]
                        for rm in rooms
                        for r_id in r_ids
                        if (d, t, rm.id, w_id, r_id) in shifts
                    ]
                    for j in range(i - 1, -1, -1):
                        prev_t = start_times[j]
                        if prev_t + duration > t:
                            active_for_worker.extend([
                                shifts[(d, prev_t, rm.id, w_id, r_id)]
                                for rm in rooms
                                for r_id in r_ids
                                if (d, prev_t, rm.id, w_id, r_id) in shifts
                            ])
                        else:
                            break
                    if active_for_worker:
                        model.Add(sum(active_for_worker) <= 1)

                for rm in rooms:
                    active_in_room = [
                        shifts[(d, t, rm.id, w_id, r_id)]
                        for w_id, r_ids in worker_roles.items()
                        for r_id in r_ids
                        if (d, t, rm.id, w_id, r_id) in shifts
                    ]
                    for j in range(i - 1, -1, -1):
                        prev_t = start_times[j]
                        if prev_t + duration > t:
                            active_in_room.extend([
                                shifts[(d, prev_t, rm.id, w_id, r_id)]
                                for w_id, r_ids in worker_roles.items()
                                for r_id in r_ids
                                if (d, prev_t, rm.id, w_id, r_id) in shifts
                            ])
                        else:
                            break
                    if active_in_room:
                        model.Add(sum(active_in_room) <= rm.capacity)

        # --- Constraint D: Concurrency cap per role ---
        for d in target_days:
            for t in start_times:
                for r_id, w_ids in role_workers.items():
                    active = [
                        shifts[(d, t, rm.id, w_id, r_id)]
                        for rm in rooms
                        for w_id in w_ids
                        if (d, t, rm.id, w_id, r_id) in shifts
                    ]
                    if active:
                        model.Add(sum(active) <= max_concurrent)

        # --- Scoring ---
        scores = {}
        for d in target_days:
            for t in start_times:
                for w_id, r_ids in worker_roles.items():
                    for r_id in r_ids:
                        scores[(d, t, w_id, r_id)] = 100 - ((t - 480) // interval)

        # Lecture bonus
        for obs in fixed_obs:
            obs_days = [d.day for d in obs.days.all()]
            o_start  = time_to_mins(obs.start_time)
            o_end    = time_to_mins(obs.end_time)
            r_id     = obs.role_id
            for d in obs_days:
                if d in target_days:
                    for t in start_times:
                        shift_end = t + duration
                        if 0 <= (o_start - shift_end) <= 60 or 0 <= (t - o_end) <= 60:
                            for w_id in role_workers.get(r_id, []):
                                scores[(d, t, w_id, r_id)] += 500

        # Campus bonus
        for (w_id, day), busies in busy_map.items():
            if day not in target_days or w_id not in worker_roles:
                continue
            for busy in busies:
                b_start = time_to_mins(busy.start_time)
                b_end   = time_to_mins(busy.end_time)
                for t in start_times:
                    shift_end = t + duration
                    if 0 <= (b_start - shift_end) <= 60 or 0 <= (t - b_end) <= 60:
                        for r_id in worker_roles[w_id]:
                            scores[(day, t, w_id, r_id)] += 200

        # Preference bonus
        for (w_id, day), prefs in pref_map.items():
            if day not in target_days or w_id not in worker_roles:
                continue
            for pref in prefs:
                p_start = time_to_mins(pref.start_time)
                p_end   = time_to_mins(pref.end_time)
                for t in start_times:
                    shift_end = t + duration
                    if t >= p_start and shift_end <= p_end:
                        for r_id in worker_roles[w_id]:
                            scores[(day, t, w_id, r_id)] += 300

        # --- Objective ---
        quality_terms = [
            shifts[(d, t, rm.id, w_id, r_id)] * scores[(d, t, w_id, r_id)]
            for d in target_days
            for t in start_times
            for rm in rooms
            for w_id, r_ids in worker_roles.items()
            for r_id in r_ids
            if (d, t, rm.id, w_id, r_id) in shifts
        ]

        if partial:
            # Primary objective: schedule as many sessions as possible.
            # Use a large weight so that an extra session always beats any quality gain.
            volume_weight = max(s for s in scores.values()) + 1
            volume_terms  = [
                shifts[k] * volume_weight
                for k in shifts
            ]
            model.Maximize(sum(volume_terms) + sum(quality_terms))
        else:
            model.Maximize(sum(quality_terms))

        return model, shifts

    # ------------------------------------------------------------------
    # 6. RESULT EXTRACTION
    # ------------------------------------------------------------------
    def _extract(solver, shifts):
        results = []
        for (d, t, rm_id, w_id, r_id), var in shifts.items():
            if solver.Value(var) == 1:
                results.append({
                    "day": d,
                    "start_min": t,
                    "end_min": t + duration,
                    "room_id": rm_id,
                    "user_id": w_id,
                    "role_id": r_id,
                })
        return results

    def _compute_shortfalls(results):
        assigned_counts = {}
        for r in results:
            key = (r["user_id"], r["role_id"])
            assigned_counts[key] = assigned_counts.get(key, 0) + 1

        shortfalls = []
        for w_id, r_ids in worker_roles.items():
            for r_id in r_ids:
                assigned = assigned_counts.get((w_id, r_id), 0)
                if assigned < weekly_quota:
                    shortfalls.append({
                        "user_id":   w_id,
                        "role_id":   r_id,
                        "user_name": user_name_map.get(w_id, f"Worker {w_id}"),
                        "role_name": role_name_map.get(r_id, f"Role {r_id}"),
                        "assigned":  assigned,
                        "quota":     weekly_quota,
                    })
        return shortfalls

    # ------------------------------------------------------------------
    # 7. THREE-PHASE SOLVING
    # ------------------------------------------------------------------

    # --- Phase 1: strict constraints, original timeout ---
    model, shifts = _build_model(partial=False)
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = timeout
    status = solver.Solve(model)

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return _extract(solver, shifts), []

    # --- Phase 2: strict constraints, extended timeout (only if we timed out) ---
    # INFEASIBLE is provably unsolvable — extra time won't help.
    if status == cp_model.UNKNOWN:
        model, shifts = _build_model(partial=False)
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = timeout * 2
        status = solver.Solve(model)

        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return _extract(solver, shifts), []

    # --- Phase 3: relaxed constraints, maximise sessions scheduled ---
    model, shifts = _build_model(partial=True)
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = timeout * 2
    status = solver.Solve(model)

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        results    = _extract(solver, shifts)
        shortfalls = _compute_shortfalls(results)
        return results, shortfalls

    # Truly unsolvable even partially (e.g., no rooms, no workers)
    return [], []