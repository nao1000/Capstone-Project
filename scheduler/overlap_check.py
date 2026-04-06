import pandas as pd
from datetime import datetime

def check_for_overlaps(file_path):
    print(f"Loading schedule from: {file_path}")
    
    try:
        # Load the excel file
        df = pd.read_excel(file_path)
    except FileNotFoundError:
        print(f"Error: Could not find the file '{file_path}'. Make sure the name is correct!")
        return

    # Convert the string times ("14:30") into datetime objects so we can do math on them
    df['Start Time'] = pd.to_datetime(df['Start Time'], format='%H:%M')
    df['End Time'] = pd.to_datetime(df['End Time'], format='%H:%M')

    overlaps_found = 0

    # Group the shifts by Day and Room
    # This means we only compare shifts that are happening in the same room on the same day
    grouped = df.groupby(['Day', 'Room'])

    for (day, room), group in grouped:
        # Sort the shifts in this room by start time
        shifts = group.sort_values(by='Start Time').to_dict('records')
        
        # Compare each shift against the ones scheduled after it
        for i in range(len(shifts)):
            for j in range(i + 1, len(shifts)):
                shift_a = shifts[i]
                shift_b = shifts[j]
                
                # The Overlap Math Formula: 
                # (Start A < End B) AND (End A > Start B)
                if (shift_a['Start Time'] < shift_b['End Time']) and (shift_a['End Time'] > shift_b['Start Time']):
                    overlaps_found += 1
                    
                    # Convert back to readable strings for printing
                    time_a = f"{shift_a['Start Time'].strftime('%H:%M')} - {shift_a['End Time'].strftime('%H:%M')}"
                    time_b = f"{shift_b['Start Time'].strftime('%H:%M')} - {shift_b['End Time'].strftime('%H:%M')}"
                    
                    print("\n🚨 OVERLAP DETECTED 🚨")
                    print(f"Day:  {day} | Room: {room}")
                    print(f"  Shift 1: {shift_a['Worker']} ({shift_a['Role']}) @ {time_a}")
                    print(f"  Shift 2: {shift_b['Worker']} ({shift_b['Role']}) @ {time_b}")

    print("-" * 40)
    if overlaps_found == 0:
        print("✅ Schedule is perfectly clean! No overlapping shifts found in any room.")
    else:
        print(f"❌ Found {overlaps_found} overlapping conflicts!")

if __name__ == "__main__":
    # Change this filename to match exactly what you downloaded!
    excel_filename = "Spring_2026_schedule.xlsx" 
    check_for_overlaps(excel_filename)