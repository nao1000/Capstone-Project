from ortools.sat.python import cp_model
from .models import (
    TeamRoleAssignment,
    AvailabilityRange,
    FixedObstruction,
    Room,
    RoomAvailability,
)

def generate_schedule(team, roles=None, target_days=["sun", "mon", "tue", "wed", "thu", "fri"], timeout=30.0):
    model = cp_model.CpModel()

    # 1. FETCH DJANGO DATA
    # If roles is None, fetch ALL roles for the team. 
    # If it's a single role or list of roles, filter by it.
    if roles is None:
        assignments = TeamRoleAssignment.objects.filter(team=team).select_related('role', 'user')
    else:
        # Check if a single role was passed, convert to list
        try:
            iter(roles)
        except TypeError:
            roles = [roles]
        assignments = TeamRoleAssignment.objects.filter(team=team, role__in=roles).select_related('role', 'user')

    rooms = list(Room.objects.filter(team=team))
    start_times = list(range(480, 1050, 30))

    # Build relational dictionaries so we know which worker has which roles
    worker_roles = {}  # worker_id -> list of role_ids
    role_workers = {}  # role_id -> list of worker_ids
    
    for a in assignments:
        w_id = a.user.id
        r_id = a.role.id
        worker_roles.setdefault(w_id, []).append(r_id)
        role_workers.setdefault(r_id, []).append(w_id)

    worker_ids = list(worker_roles.keys())
    active_role_ids = list(role_workers.keys())

    # 2. CREATE THE VARIABLES (Session Start Times)
    shifts = {}
    for d in target_days:
        for t in start_times:
            for rm in rooms:
                for w_id, r_ids in worker_roles.items():
                    for r_id in r_ids:
                        # Variable: 1 if worker 'w_id' STARTS a 50-min session for 'r_id' at time 't'
                        shifts[(d, t, rm.id, w_id, r_id)] = model.NewBoolVar(
                            f"shift_{d}_{t}_{rm.id}_{w_id}_{r_id}"
                        )

    # 3. CONSTRAINTS

    # CONSTRAINT A: Shift Limits (3 per week per role, max 1 per day across all roles)
    for w_id, r_ids in worker_roles.items():
        for r_id in r_ids:
            # Exactly 3 shifts for the week FOR THIS ROLE
            model.Add(
                sum(
                    shifts[(d, t, rm.id, w_id, r_id)]
                    for d in target_days
                    for t in start_times
                    for rm in rooms
                ) == 3
            )
            
        # Max 1 shift per day for this worker (Across ALL of their roles)
        for d in target_days:
            model.Add(
                sum(
                    shifts[(d, t, rm.id, w_id, r_id)] 
                    for t in start_times 
                    for rm in rooms
                    for r_id in r_ids
                ) <= 1
            )

    # CONSTRAINT B: Overlap & Capacity (The 50-Minute Rule)
    for d in target_days:
        for i, t in enumerate(start_times):

            # 1. No Double-Booking Workers (across all their roles)
            for w_id, r_ids in worker_roles.items():
                active_for_worker = [shifts[(d, t, rm.id, w_id, r_id)] for rm in rooms for r_id in r_ids]
                if i > 0:  
                    prev_t = start_times[i - 1]
                    active_for_worker.extend(
                        [shifts[(d, prev_t, rm.id, w_id, r_id)] for rm in rooms for r_id in r_ids]
                    )
                model.Add(sum(active_for_worker) <= 1)

            # 2. Room Capacity (across all workers and roles)
            for rm in rooms:
                active_in_room = [
                    shifts[(d, t, rm.id, w_id, r_id)] 
                    for w_id, r_ids in worker_roles.items() 
                    for r_id in r_ids
                ]
                if i > 0:
                    prev_t = start_times[i - 1]
                    active_in_room.extend(
                        [shifts[(d, prev_t, rm.id, w_id, r_id)] 
                         for w_id, r_ids in worker_roles.items() 
                         for r_id in r_ids]
                    )
                model.Add(sum(active_in_room) <= rm.capacity)

    # CONSTRAINT C: Blockouts (Obstructions & Availability)
    def time_to_mins(tm):
        return tm.hour * 60 + tm.minute

    # Individual busy times
    busy_times = AvailabilityRange.objects.filter(team=team, user_id__in=worker_ids)
    for busy in busy_times:
        if busy.day in target_days and busy.user_id in worker_roles:
            b_start = time_to_mins(busy.start_time)
            b_end = time_to_mins(busy.end_time)

            for t in start_times:
                shift_end = t + 50
                if t < b_end and shift_end > b_start:
                    for rm in rooms:
                        for r_id in worker_roles[busy.user_id]:
                            model.Add(shifts[(busy.day, t, rm.id, busy.user_id, r_id)] == 0)

    # Fixed Obstructions (Role-wide)
    fixed_obs = FixedObstruction.objects.filter(team=team, role_id__in=active_role_ids).prefetch_related("days")
    for obs in fixed_obs:
        obs_days = [d.day for d in obs.days.all()]
        b_start = time_to_mins(obs.start_time)
        b_end = time_to_mins(obs.end_time)
        r_id = obs.role_id

        for d in obs_days:
            if d in target_days:
                for t in start_times:
                    shift_end = t + 50
                    if t < b_end and shift_end > b_start:
                        for rm in rooms:
                            for w_id in role_workers.get(r_id, []):
                                model.Add(shifts[(d, t, rm.id, w_id, r_id)] == 0)

    # Room Availability (Doors must be open!)
    room_avails = RoomAvailability.objects.filter(room__in=rooms)
    for d in target_days:
        for t in start_times:
            shift_end = t + 50
            for rm in rooms:
                daily_avails = [ra for ra in room_avails if ra.room_id == rm.id and ra.day == d]
                is_open = False
                for avail in daily_avails:
                    open_start = time_to_mins(avail.start_time)
                    open_end = time_to_mins(avail.end_time)
                    if t >= open_start and shift_end <= open_end:
                        is_open = True
                        break

                if not is_open:
                    for w_id, r_ids in worker_roles.items():
                        for r_id in r_ids:
                            model.Add(shifts[(d, t, rm.id, w_id, r_id)] == 0)

    # CONSTRAINT D: Spread Out Sessions (Concurrency Limit per Role)
    for d in target_days:
        for t in start_times:
            for r_id, w_ids in role_workers.items():
                model.Add(
                    sum(shifts[(d, t, rm.id, w_id, r_id)] for rm in rooms for w_id in w_ids) <= 1
                )

    # 4. SCORING SYSTEM (Soft Constraints)
    scores = {}

    for d in target_days:
        for t in start_times:
            for w_id, r_ids in worker_roles.items():
                for r_id in r_ids:
                    scores[(d, t, w_id, r_id)] = 100 - ((t - 480) // 30)

    # Apply The Lecture Bonus (Role Fixed Obstructions)
    for obs in fixed_obs:
        obs_days = [d.day for d in obs.days.all()]
        o_start = time_to_mins(obs.start_time)
        o_end = time_to_mins(obs.end_time)
        r_id = obs.role_id

        for d in obs_days:
            if d in target_days:
                for t in start_times:
                    shift_end = t + 50
                    if 0 <= (o_start - shift_end) <= 60 or 0 <= (t - o_end) <= 60:
                        for w_id in role_workers.get(r_id, []):
                            scores[(d, t, w_id, r_id)] += 500

    # Apply The Campus Bonus (Personal Worker Classes/Busy times)
    for busy in busy_times:
        if busy.day in target_days and busy.user_id in worker_roles:
            b_start = time_to_mins(busy.start_time)
            b_end = time_to_mins(busy.end_time)
            w_id = busy.user_id

            for t in start_times:
                shift_end = t + 50
                if 0 <= (b_start - shift_end) <= 60 or 0 <= (t - b_end) <= 60:
                    for r_id in worker_roles[w_id]:
                        scores[(busy.day, t, w_id, r_id)] += 200

    # 5. SOLVE & EXTRACT DATA
    model.Maximize(
        sum(
            shifts[(d, t, rm.id, w_id, r_id)] * scores[(d, t, w_id, r_id)]
            for d in target_days
            for t in start_times
            for rm in rooms
            for w_id, r_ids in worker_roles.items()
            for r_id in r_ids
        )
    )

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = timeout  # Up to 30s by default for big runs
    status = solver.Solve(model)

    results = []
    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
        for d in target_days:
            for t in start_times:
                for rm in rooms:
                    for w_id, r_ids in worker_roles.items():
                        for r_id in r_ids:
                            if solver.Value(shifts[(d, t, rm.id, w_id, r_id)]) == 1:
                                results.append(
                                    {
                                        "day": d,
                                        "start_min": t,
                                        "end_min": t + 50,
                                        "room_id": rm.id,
                                        "user_id": w_id,
                                        "role_id": r_id,
                                    }
                                )

    return results