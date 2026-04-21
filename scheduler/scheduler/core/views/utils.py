'''
views/utils.py
Shared constants and time-conversion helpers used across all view modules.
'''

from datetime import time

DAY_MAP = {0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat"}


def time_to_minutes(t):
    if t is None:
        return None
    return (t.hour * 60) + t.minute


def minutes_to_time(minutes):
    if minutes is None:
        return None
    return time(int(minutes) // 60, int(minutes) % 60)


def minutes_to_string(minutes):
    if minutes is None:
        return ""
    t = minutes_to_time(minutes)
    return f"{t.hour:02d}:{t.minute:02d}"