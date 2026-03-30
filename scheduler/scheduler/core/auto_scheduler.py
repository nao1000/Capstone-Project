from ortools.sat.python import cp_model
from .models import (
    TeamRoleAssignment,
    AvailabilityRange,
    FixedObstruction,
    Room,
    RoomAvailability,
)


def generate_role_schedule(team, role, target_days=["mon", "tue", "wed", "thu", "fri"]):
    model = cp_model.CpModel()

    # 1. FETCH DJANGO DATA
    assignments = TeamRoleAssignment.objects.filter(team=team, role=role)
    worker_ids = [a.user.id for a in assignments]
    rooms = list(Room.objects.filter(team=team))

    # Define our start times in "minutes from midnight"
    # 480 = 8:00 AM, 510 = 8:30 AM, ..., 1020 = 5:00 PM
    start_times = list(range(480, 1050, 30))

    # 2. CREATE THE VARIABLES (Session Start Times)
    shifts = {}
    for d in target_days:
        for t in start_times:
            for r in rooms:
                for w in worker_ids:
                    # Variable: 1 if worker 'w' STARTS a 50-min session at time 't'
                    shifts[(d, t, r.id, w)] = model.NewBoolVar(
                        f"shift_{d}_{t}_{r.id}_{w}"
                    )

    # 3. CONSTRAINTS

    # CONSTRAINT A: Shift Limits (3 per week, max 1 per day)
    for w in worker_ids:
        # Exactly 3 shifts for the week
        model.Add(
            sum(
                shifts[(d, t, r.id, w)]
                for d in target_days
                for t in start_times
                for r in rooms
            )
            == 3
        )
        # Max 1 shift per day for this worker
        for d in target_days:
            model.Add(
                sum(shifts[(d, t, r.id, w)] for t in start_times for r in rooms) <= 1
            )

    # CONSTRAINT B: Overlap & Capacity (The 50-Minute Rule)
    # A shift starting at `t` overlaps with a shift starting at `t-30`.
    for d in target_days:
        for i, t in enumerate(start_times):

            # 1. No Double-Booking Workers
            for w in worker_ids:
                active_for_worker = [shifts[(d, t, r.id, w)] for r in rooms]
                if (
                    i > 0
                ):  # If there was a previous 30-min slot, check if a shift started then
                    prev_t = start_times[i - 1]
                    active_for_worker.extend(
                        [shifts[(d, prev_t, r.id, w)] for r in rooms]
                    )

                # Worker can only have 1 active session across all rooms during this 30 min window
                model.Add(sum(active_for_worker) <= 1)

            # 2. Room Capacity
            for r in rooms:
                active_in_room = [shifts[(d, t, r.id, w)] for w in worker_ids]
                if i > 0:
                    prev_t = start_times[i - 1]
                    active_in_room.extend(
                        [shifts[(d, prev_t, r.id, w)] for w in worker_ids]
                    )

                # Total active sessions in this room cannot exceed capacity
                model.Add(sum(active_in_room) <= r.capacity)

    # CONSTRAINT C: Blockouts (Obstructions & Availability)
    def time_to_mins(tm):
        return tm.hour * 60 + tm.minute

    # Individual busy times
    busy_times = AvailabilityRange.objects.filter(team=team, user_id__in=worker_ids)
    for busy in busy_times:
        if busy.day in target_days:
            b_start = time_to_mins(busy.start_time)
            b_end = time_to_mins(busy.end_time)

            for t in start_times:
                shift_end = t + 50
                # Math check: Does this 50 min shift overlap with the busy period?
                if t < b_end and shift_end > b_start:
                    for r in rooms:
                        model.Add(shifts[(busy.day, t, r.id, busy.user.id)] == 0)

    # Fixed Obstructions (Role-wide)
    fixed_obs = FixedObstruction.objects.filter(team=team, role=role).prefetch_related(
        "days"
    )
    for obs in fixed_obs:
        obs_days = [d.day for d in obs.days.all()]
        b_start = time_to_mins(obs.start_time)
        b_end = time_to_mins(obs.end_time)

        for d in obs_days:
            if d in target_days:
                for t in start_times:
                    shift_end = t + 50
                    if t < b_end and shift_end > b_start:
                        for r in rooms:
                            for w in worker_ids:
                                model.Add(shifts[(d, t, r.id, w)] == 0)
    # ---------------------------------------------------------
    # NEW: Room Availability (Doors must be open!)
    # ---------------------------------------------------------
    # Fetch all open blocks for the rooms we are looking at
    room_avails = RoomAvailability.objects.filter(room__in=rooms)

    for d in target_days:
        for t in start_times:
            shift_end = t + 50
            for r in rooms:
                # Find if this room is open on this specific day
                daily_avails = [
                    ra for ra in room_avails if ra.room_id == r.id and ra.day == d
                ]

                is_open = False
                for avail in daily_avails:
                    open_start = time_to_mins(avail.start_time)
                    open_end = time_to_mins(avail.end_time)

                    # Does this 50-minute shift fit entirely inside an open window?
                    if t >= open_start and shift_end <= open_end:
                        is_open = True
                        break

                # If no open window was found that fits this shift, explicitly forbid it!
                if not is_open:
                    for w in worker_ids:
                        model.Add(shifts[(d, t, r.id, w)] == 0)
    # ---------------------------------------------------------
    # CONSTRAINT D: Spread Out Sessions (Concurrency Limit)
    # Prevent the solver from stacking multiple workers for the
    # same role at the exact same time just to harvest points.
    # ---------------------------------------------------------
    for d in target_days:
        for t in start_times:
            # The sum of all shifts for this role at this exact minute cannot exceed 1
            model.Add(
                sum(shifts[(d, t, r.id, w)] for r in rooms for w in worker_ids) <= 1
            )
    # ---------------------------------------------------------
    # 4. SCORING SYSTEM (Soft Constraints)
    # ---------------------------------------------------------
    scores = {}

    # Initialize base scores
    for d in target_days:
        for t in start_times:
            for w in worker_ids:
                # Base score of 100, minus a tiny penalty for later in the day
                # (prevents the 5PM clustering tie-breaker)
                base_score = 100 - ((t - 480) // 30)
                scores[(d, t, w)] = base_score

    # Apply The Lecture Bonus (Role Fixed Obstructions)
    for obs in fixed_obs:
        obs_days = [d.day for d in obs.days.all()]
        o_start = time_to_mins(obs.start_time)
        o_end = time_to_mins(obs.end_time)

        for d in obs_days:
            if d in target_days:
                for t in start_times:
                    shift_end = t + 50
                    # Is this shift ending right before the lecture? (within 60 mins)
                    if 0 <= (o_start - shift_end) <= 60:
                        for w in worker_ids:
                            scores[(d, t, w)] += 500
                    # Is this shift starting right after the lecture? (within 60 mins)
                    elif 0 <= (t - o_end) <= 60:
                        for w in worker_ids:
                            scores[(d, t, w)] += 500

    # Apply The Campus Bonus (Personal Worker Classes/Busy times)
    for busy in busy_times:
        if busy.day in target_days:
            b_start = time_to_mins(busy.start_time)
            b_end = time_to_mins(busy.end_time)
            w = busy.user.id

            for t in start_times:
                shift_end = t + 50
                # Shift ends right before they go to class
                if 0 <= (b_start - shift_end) <= 60:
                    scores[(busy.day, t, w)] += 200
                # Shift starts right after they get out of class
                elif 0 <= (t - b_end) <= 60:
                    scores[(busy.day, t, w)] += 200

    # ---------------------------------------------------------
    # 5. SOLVE & EXTRACT DATA
    # ---------------------------------------------------------

    # NEW GOAL: Maximize the total SCORE of the assigned shifts!
    model.Maximize(
        sum(
            shifts[(d, t, r.id, w)] * scores[(d, t, w)]
            for d in target_days
            for t in start_times
            for r in rooms
            for w in worker_ids
        )
    )

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 10.0
    status = solver.Solve(model)

    results = []
    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
        for d in target_days:
            for t in start_times:
                for r in rooms:
                    for w in worker_ids:
                        if solver.Value(shifts[(d, t, r.id, w)]) == 1:
                            results.append(
                                {
                                    "day": d,
                                    "start_min": t,
                                    "end_min": t + 50,
                                    "room_id": r.id,
                                    "user_id": w,
                                    "role_id": role.id,
                                }
                            )

    return results
