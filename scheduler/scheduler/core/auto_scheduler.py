from ortools.sat.python import cp_model
from .models import (
    TeamRoleAssignment,
    AvailabilityRange,
    FixedObstruction,
    Room,
    RoomAvailability,
    PreferredTime,
)

def generate_schedule(team, roles=None, target_days=["sun", "mon", "tue", "wed", "thu", "fri"], timeout=30.0, config=None):
    
    # 1. Set configuration defaults if none provided
    if config is None:
        config = {
            "duration": 50,
            "interval": 30,
            "weekly_quota": 3,
            "daily_max": 1,
            "max_concurrent": 1
        }
        
    duration = config.get("duration", 50)
    interval = config.get("interval", 30)
    weekly_quota = config.get("weekly_quota", 3)
    daily_max = config.get("daily_max", 1)
    max_concurrent = config.get("max_concurrent", 1)

    model = cp_model.CpModel()

    # 1. FETCH DJANGO DATA
    if roles is None:
        assignments = TeamRoleAssignment.objects.filter(team=team).select_related('role', 'user')
    else:
        try:
            iter(roles)
        except TypeError:
            roles = [roles]
        assignments = TeamRoleAssignment.objects.filter(team=team, role__in=roles).select_related('role', 'user')

    rooms = list(Room.objects.filter(team=team))
    
    # Dynamic Start Times based on the custom interval
    start_times = list(range(480, 1050, interval))

    # Build relational dictionaries
    worker_roles = {}  
    role_workers = {}  
    
    for a in assignments:
        w_id = a.user.id
        r_id = a.role.id
        worker_roles.setdefault(w_id, []).append(r_id)
        role_workers.setdefault(r_id, []).append(w_id)

    worker_ids = list(worker_roles.keys())
    active_role_ids = list(role_workers.keys())

    def time_to_mins(tm):
        return tm.hour * 60 + tm.minute

    # --- PRE-INDEX LOOKUPS (avoids repeated linear scans inside loops) ---

    # Room availability indexed by (room_id, day)
    room_avails = RoomAvailability.objects.filter(room__in=rooms)
    room_avail_map = {}
    for ra in room_avails:
        room_avail_map.setdefault((ra.room_id, ra.day), []).append(ra)

    # Busy times indexed by (user_id, day)
    busy_times = AvailabilityRange.objects.filter(team=team, user_id__in=worker_ids)
    busy_map = {}
    for busy in busy_times:
        busy_map.setdefault((busy.user_id, busy.day), []).append(busy)

    # Fixed obstructions fetched once
    fixed_obs = FixedObstruction.objects.filter(team=team, role_id__in=active_role_ids).prefetch_related("days")

    # Preferred times indexed by (user_id, day)
    preferred_times = PreferredTime.objects.filter(team=team, user_id__in=worker_ids)
    pref_map = {}
    for pref in preferred_times:
        pref_map.setdefault((pref.user_id, pref.day), []).append(pref)

    # --- PRE-COMPUTE BLOCKED (worker, day, time) COMBINATIONS ---
    # Skip creating variables for slots we know are impossible
    blocked = set()

    # Block from individual busy times
    for (w_id, day), busies in busy_map.items():
        if day not in target_days:
            continue
        for busy in busies:
            b_start = time_to_mins(busy.start_time)
            b_end = time_to_mins(busy.end_time)
            for t in start_times:
                if t < b_end and (t + duration) > b_start:
                    blocked.add((w_id, day, t))

    # Block from fixed obstructions (per worker in that role)
    for obs in fixed_obs:
        obs_days = [d.day for d in obs.days.all()]
        b_start = time_to_mins(obs.start_time)
        b_end = time_to_mins(obs.end_time)
        r_id = obs.role_id
        for d in obs_days:
            if d not in target_days:
                continue
            for t in start_times:
                if t < b_end and (t + duration) > b_start:
                    for w_id in role_workers.get(r_id, []):
                        blocked.add((w_id, d, t))

    # Block from room unavailability — if ALL rooms are closed at a time, block every worker
    room_blocked = set()  # (day, time) where no room is open
    for d in target_days:
        for t in start_times:
            shift_end = t + duration
            all_closed = True
            for rm in rooms:
                daily_avails = room_avail_map.get((rm.id, d), [])
                for avail in daily_avails:
                    open_start = time_to_mins(avail.start_time)
                    open_end = time_to_mins(avail.end_time)
                    if t >= open_start and shift_end <= open_end:
                        all_closed = False
                        break
                if not all_closed:
                    break
            if all_closed:
                room_blocked.add((d, t))

    # 2. CREATE THE VARIABLES (skip impossible combinations)
    shifts = {}
    for d in target_days:
        for t in start_times:
            if (d, t) in room_blocked:
                continue  # No room is open at this time, skip all workers
            for rm in rooms:
                # Check if this room is open at this time
                shift_end = t + duration
                daily_avails = room_avail_map.get((rm.id, d), [])
                room_open = any(
                    time_to_mins(avail.start_time) <= t and shift_end <= time_to_mins(avail.end_time)
                    for avail in daily_avails
                )
                if not room_open:
                    continue  # This room is closed at this time, skip

                for w_id, r_ids in worker_roles.items():
                    if (w_id, d, t) in blocked:
                        continue  # Worker is busy at this time, skip
                    for r_id in r_ids:
                        shifts[(d, t, rm.id, w_id, r_id)] = model.NewBoolVar(
                            f"shift_{d}_{t}_{rm.id}_{w_id}_{r_id}"
                        )

    # Helper to safely get shift variables (returns empty list for pruned slots)
    def get_shifts(d, t, rm_id, w_id, r_id):
        key = (d, t, rm_id, w_id, r_id)
        return [shifts[key]] if key in shifts else []

    # 3. CONSTRAINTS

    # CONSTRAINT A: Shift Limits
    for w_id, r_ids in worker_roles.items():
        for r_id in r_ids:
            model.Add(
                sum(
                    shifts[(d, t, rm.id, w_id, r_id)]
                    for d in target_days
                    for t in start_times
                    for rm in rooms
                    if (d, t, rm.id, w_id, r_id) in shifts
                ) == weekly_quota
            )
            
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

    # CONSTRAINT B: Overlap & Capacity
    for d in target_days:
        for i, t in enumerate(start_times):

            # 1. No Double-Booking Workers
            for w_id, r_ids in worker_roles.items():
                active_for_worker = [
                    shifts[(d, t, rm.id, w_id, r_id)]
                    for rm in rooms for r_id in r_ids
                    if (d, t, rm.id, w_id, r_id) in shifts
                ]
                
                # Look backwards — break early once overlap is impossible
                for j in range(i - 1, -1, -1):
                    prev_t = start_times[j]
                    if prev_t + duration > t:
                        active_for_worker.extend([
                            shifts[(d, prev_t, rm.id, w_id, r_id)]
                            for rm in rooms for r_id in r_ids
                            if (d, prev_t, rm.id, w_id, r_id) in shifts
                        ])
                    else:
                        break  # Earlier slots can't overlap, stop looking

                if active_for_worker:
                    model.Add(sum(active_for_worker) <= 1)

            # 2. Room Capacity
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
                        break  # Earlier slots can't overlap, stop looking

                if active_in_room:
                    model.Add(sum(active_in_room) <= rm.capacity)

    # CONSTRAINT C: Blockouts are already handled by pruning variables above,
    # but we still need the room availability constraint per-room (not all-closed case)
    # — already handled by skipping closed rooms during variable creation.

    # CONSTRAINT D: Spread Out Sessions (Concurrency Limit per Role)
    for d in target_days:
        for t in start_times:
            for r_id, w_ids in role_workers.items():
                active = [
                    shifts[(d, t, rm.id, w_id, r_id)]
                    for rm in rooms for w_id in w_ids
                    if (d, t, rm.id, w_id, r_id) in shifts
                ]
                if active:
                    model.Add(sum(active) <= max_concurrent)

    # 4. SCORING SYSTEM (Soft Constraints)
    scores = {}

    for d in target_days:
        for t in start_times:
            for w_id, r_ids in worker_roles.items():
                for r_id in r_ids:
                    scores[(d, t, w_id, r_id)] = 100 - ((t - 480) // interval)

    # Lecture Bonus — schedule close to the role's fixed class time
    for obs in fixed_obs:
        obs_days = [d.day for d in obs.days.all()]
        o_start = time_to_mins(obs.start_time)
        o_end = time_to_mins(obs.end_time)
        r_id = obs.role_id

        for d in obs_days:
            if d in target_days:
                for t in start_times:
                    shift_end = t + duration
                    if 0 <= (o_start - shift_end) <= 60 or 0 <= (t - o_end) <= 60:
                        for w_id in role_workers.get(r_id, []):
                            scores[(d, t, w_id, r_id)] += 500

    # Campus Bonus — schedule close to the worker's personal busy block
    for (w_id, day), busies in busy_map.items():
        if day not in target_days or w_id not in worker_roles:
            continue
        for busy in busies:
            b_start = time_to_mins(busy.start_time)
            b_end = time_to_mins(busy.end_time)
            for t in start_times:
                shift_end = t + duration
                if 0 <= (b_start - shift_end) <= 60 or 0 <= (t - b_end) <= 60:
                    for r_id in worker_roles[w_id]:
                        scores[(day, t, w_id, r_id)] += 200

    # Preference Bonus — schedule within the worker's preferred time window
    for (w_id, day), prefs in pref_map.items():
        if day not in target_days or w_id not in worker_roles:
            continue
        for pref in prefs:
            p_start = time_to_mins(pref.start_time)
            p_end = time_to_mins(pref.end_time)
            for t in start_times:
                shift_end = t + duration
                if t >= p_start and shift_end <= p_end:
                    for r_id in worker_roles[w_id]:
                        scores[(day, t, w_id, r_id)] += 300

    # 5. SOLVE & EXTRACT DATA
    model.Maximize(
        sum(
            shifts[(d, t, rm.id, w_id, r_id)] * scores[(d, t, w_id, r_id)]
            for d in target_days
            for t in start_times
            for rm in rooms
            for w_id, r_ids in worker_roles.items()
            for r_id in r_ids
            if (d, t, rm.id, w_id, r_id) in shifts
        )
    )

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = timeout
    status = solver.Solve(model)

    results = []
    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
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

# from ortools.sat.python import cp_model
# from .models import (
#     TeamRoleAssignment,
#     AvailabilityRange,
#     FixedObstruction,
#     Room,
#     RoomAvailability,
#     PreferredTime,
# )

# def generate_schedule(team, roles=None, target_days=["sun", "mon", "tue", "wed", "thu", "fri"], timeout=30.0, config=None):
    
#     # 1. Set configuration defaults if none provided
#     if config is None:
#         config = {
#             "duration": 50,
#             "interval": 30,
#             "weekly_quota": 3,
#             "daily_max": 1,
#             "max_concurrent": 1
#         }
        
#     duration = config.get("duration", 50)
#     interval = config.get("interval", 30)
#     weekly_quota = config.get("weekly_quota", 3)
#     daily_max = config.get("daily_max", 1)
#     max_concurrent = config.get("max_concurrent", 1)

#     model = cp_model.CpModel()

#     # 1. FETCH DJANGO DATA
#     if roles is None:
#         assignments = TeamRoleAssignment.objects.filter(team=team).select_related('role', 'user')
#     else:
#         try:
#             iter(roles)
#         except TypeError:
#             roles = [roles]
#         assignments = TeamRoleAssignment.objects.filter(team=team, role__in=roles).select_related('role', 'user')

#     rooms = list(Room.objects.filter(team=team))
    
#     # Dynamic Start Times based on the custom interval
#     start_times = list(range(480, 1050, interval))

#     # Build relational dictionaries
#     worker_roles = {}  
#     role_workers = {}  
    
#     for a in assignments:
#         w_id = a.user.id
#         r_id = a.role.id
#         worker_roles.setdefault(w_id, []).append(r_id)
#         role_workers.setdefault(r_id, []).append(w_id)

#     worker_ids = list(worker_roles.keys())
#     active_role_ids = list(role_workers.keys())

#     # 2. CREATE THE VARIABLES
#     shifts = {}
#     for d in target_days:
#         for t in start_times:
#             for rm in rooms:
#                 for w_id, r_ids in worker_roles.items():
#                     for r_id in r_ids:
#                         shifts[(d, t, rm.id, w_id, r_id)] = model.NewBoolVar(
#                             f"shift_{d}_{t}_{rm.id}_{w_id}_{r_id}"
#                         )

#     # 3. CONSTRAINTS

#     # CONSTRAINT A: Shift Limits
#     for w_id, r_ids in worker_roles.items():
#         for r_id in r_ids:
#             # Replaced hardcoded '3' with weekly_quota
#             model.Add(
#                 sum(
#                     shifts[(d, t, rm.id, w_id, r_id)]
#                     for d in target_days
#                     for t in start_times
#                     for rm in rooms
#                 ) == weekly_quota
#             )
            
#         # Replaced hardcoded '1' with daily_max
#         for d in target_days:
#             model.Add(
#                 sum(
#                     shifts[(d, t, rm.id, w_id, r_id)] 
#                     for t in start_times 
#                     for rm in rooms
#                     for r_id in r_ids
#                 ) <= daily_max
#             )

#     # CONSTRAINT B: Overlap & Capacity (Dynamically handles all shift lengths)
#     for d in target_days:
#         for i, t in enumerate(start_times):

#             # 1. No Double-Booking Workers
#             for w_id, r_ids in worker_roles.items():
#                 active_for_worker = [shifts[(d, t, rm.id, w_id, r_id)] for rm in rooms for r_id in r_ids]
                
#                 # Look backwards at previous shifts to see if they are still ongoing
#                 for j in range(i - 1, -1, -1):
#                     prev_t = start_times[j]
#                     if prev_t + duration > t:  # The previous shift overlaps with current time 't'
#                         active_for_worker.extend(
#                             [shifts[(d, prev_t, rm.id, w_id, r_id)] for rm in rooms for r_id in r_ids]
#                         )
#                 model.Add(sum(active_for_worker) <= 1)

#             # 2. Room Capacity
#             for rm in rooms:
#                 active_in_room = [
#                     shifts[(d, t, rm.id, w_id, r_id)] 
#                     for w_id, r_ids in worker_roles.items() 
#                     for r_id in r_ids
#                 ]
                
#                 # Look backwards at previous shifts to see if they are still ongoing
#                 for j in range(i - 1, -1, -1):
#                     prev_t = start_times[j]
#                     if prev_t + duration > t: 
#                         active_in_room.extend(
#                             [shifts[(d, prev_t, rm.id, w_id, r_id)] 
#                              for w_id, r_ids in worker_roles.items() 
#                              for r_id in r_ids]
#                         )
#                 model.Add(sum(active_in_room) <= rm.capacity)

#     # CONSTRAINT C: Blockouts (Obstructions & Availability)
#     def time_to_mins(tm):
#         return tm.hour * 60 + tm.minute

#     # Individual busy times
#     busy_times = AvailabilityRange.objects.filter(team=team, user_id__in=worker_ids)
#     for busy in busy_times:
#         if busy.day in target_days and busy.user_id in worker_roles:
#             b_start = time_to_mins(busy.start_time)
#             b_end = time_to_mins(busy.end_time)

#             for t in start_times:
#                 shift_end = t + duration
#                 if t < b_end and shift_end > b_start:
#                     for rm in rooms:
#                         for r_id in worker_roles[busy.user_id]:
#                             model.Add(shifts[(busy.day, t, rm.id, busy.user_id, r_id)] == 0)

#     # Fixed Obstructions (Role-wide)
#     fixed_obs = FixedObstruction.objects.filter(team=team, role_id__in=active_role_ids).prefetch_related("days")
#     for obs in fixed_obs:
#         obs_days = [d.day for d in obs.days.all()]
#         b_start = time_to_mins(obs.start_time)
#         b_end = time_to_mins(obs.end_time)
#         r_id = obs.role_id

#         for d in obs_days:
#             if d in target_days:
#                 for t in start_times:
#                     shift_end = t + duration
#                     if t < b_end and shift_end > b_start:
#                         for rm in rooms:
#                             for w_id in role_workers.get(r_id, []):
#                                 model.Add(shifts[(d, t, rm.id, w_id, r_id)] == 0)

#     # Room Availability (Doors must be open!)
#     room_avails = RoomAvailability.objects.filter(room__in=rooms)
#     for d in target_days:
#         for t in start_times:
#             shift_end = t + duration
#             for rm in rooms:
#                 daily_avails = [ra for ra in room_avails if ra.room_id == rm.id and ra.day == d]
#                 is_open = False
#                 for avail in daily_avails:
#                     open_start = time_to_mins(avail.start_time)
#                     open_end = time_to_mins(avail.end_time)
#                     if t >= open_start and shift_end <= open_end:
#                         is_open = True
#                         break

#                 if not is_open:
#                     for w_id, r_ids in worker_roles.items():
#                         for r_id in r_ids:
#                             model.Add(shifts[(d, t, rm.id, w_id, r_id)] == 0)

#     # CONSTRAINT D: Spread Out Sessions (Concurrency Limit per Role)
#     for d in target_days:
#         for t in start_times:
#             for r_id, w_ids in role_workers.items():
#                 # Replaced hardcoded '1' with max_concurrent
#                 model.Add(
#                     sum(shifts[(d, t, rm.id, w_id, r_id)] for rm in rooms for w_id in w_ids) <= max_concurrent
#                 )

#     # 4. SCORING SYSTEM (Soft Constraints)
#     scores = {}

#     for d in target_days:
#         for t in start_times:
#             for w_id, r_ids in worker_roles.items():
#                 for r_id in r_ids:
#                     scores[(d, t, w_id, r_id)] = 100 - ((t - 480) // interval)

#     # Apply The Lecture Bonus (Role Fixed Obstructions)
#     for obs in fixed_obs:
#         obs_days = [d.day for d in obs.days.all()]
#         o_start = time_to_mins(obs.start_time)
#         o_end = time_to_mins(obs.end_time)
#         r_id = obs.role_id

#         for d in obs_days:
#             if d in target_days:
#                 for t in start_times:
#                     shift_end = t + duration
#                     if 0 <= (o_start - shift_end) <= 60 or 0 <= (t - o_end) <= 60:
#                         for w_id in role_workers.get(r_id, []):
#                             scores[(d, t, w_id, r_id)] += 500

#     # Apply The Campus Bonus (Personal Worker Classes/Busy times)
#     for busy in busy_times:
#         if busy.day in target_days and busy.user_id in worker_roles:
#             b_start = time_to_mins(busy.start_time)
#             b_end = time_to_mins(busy.end_time)
#             w_id = busy.user_id

#             for t in start_times:
#                 shift_end = t + duration
#                 if 0 <= (b_start - shift_end) <= 60 or 0 <= (t - b_end) <= 60:
#                     for r_id in worker_roles[w_id]:
#                         scores[(busy.day, t, w_id, r_id)] += 200

#     # Apply The Preference Bonus (Worker Preferred times)
#     preferred_times = PreferredTime.objects.filter(team=team, user_id__in=worker_ids)
#     for pref in preferred_times:
#         if pref.day in target_days and pref.user_id in worker_roles:
#             p_start = time_to_mins(pref.start_time)
#             p_end = time_to_mins(pref.end_time)
#             w_id = pref.user_id

#             for t in start_times:
#                 shift_end = t + duration
#                 if t >= p_start and shift_end <= p_end:
#                     for r_id in worker_roles[w_id]:
#                         scores[(pref.day, t, w_id, r_id)] += 300

#     # 5. SOLVE & EXTRACT DATA
#     model.Maximize(
#         sum(
#             shifts[(d, t, rm.id, w_id, r_id)] * scores[(d, t, w_id, r_id)]
#             for d in target_days
#             for t in start_times
#             for rm in rooms
#             for w_id, r_ids in worker_roles.items()
#             for r_id in r_ids
#         )
#     )

#     solver = cp_model.CpSolver()
#     solver.parameters.max_time_in_seconds = timeout  # Up to 30s by default for big runs
#     status = solver.Solve(model)

#     results = []
#     if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
#         for d in target_days:
#             for t in start_times:
#                 for rm in rooms:
#                     for w_id, r_ids in worker_roles.items():
#                         for r_id in r_ids:
#                             if solver.Value(shifts[(d, t, rm.id, w_id, r_id)]) == 1:
#                                 results.append(
#                                     {
#                                         "day": d,
#                                         "start_min": t,
#                                         "end_min": t + duration,
#                                         "room_id": rm.id,
#                                         "user_id": w_id,
#                                         "role_id": r_id,
#                                     }
#                                 )

#     return results
