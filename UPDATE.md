1. HTML Template Changes
What to do: Just git pull on the server.
Why: Django reads your HTML templates dynamically every time a user requests a page. The moment you pull the new HTML file to the VM, your users will see the changes instantly upon refreshing.

2. CSS, JavaScript, and Image Changes
What to do: git pull AND run python manage.py collectstatic.
Why: This is the one you assumed would be fine, but it actually has a trap! Remember how Nginx is serving your static files from that STATIC_ROOT folder? If you change a CSS file locally and pull it to the VM, Nginx won't know about it until you run collectstatic to gather the updated files and copy them into Nginx's domain.

3. Python Code Changes (Views, URLs, Forms, etc.)
What to do: git pull AND restart Gunicorn (sudo systemctl restart gunicorn).
Why: Gunicorn loads your Python code into its memory when it boots up. If you change a views.py file, Gunicorn will keep running the old version of the code that it already memorized. Restarting Gunicorn forces it to dump its memory and read your updated Python files.

4. Database Model Changes (The Big One)
What to do: makemigrations locally -> Push to GitHub -> Pull to VM -> migrate on VM -> Restart Gunicorn.
Why: This is exactly what you were worried about, and here is how to keep it perfectly safe:

Locally: When you change models.py, run python manage.py makemigrations on your laptop. This creates a new migration file (e.g., 0002_new_model.py). Commit this file to Git.

On the VM: Pull the code so the VM receives that new 0002 file. Then, run python manage.py migrate on the VM so PostgreSQL updates its tables to match. Finally, restart Gunicorn so the Python code knows about the new database structure.

The "Golden Update" Cheat Sheet
Instead of trying to memorize which specific command to run for which specific change, most developers just use a standard update routine every time they push new code. It takes 10 seconds and guarantees everything works perfectly.

Whenever you SSH into your VM to deploy new code, just run these four steps in your project folder (/home/nathanoswald1/coorda/scheduler):

Bash
# 1. Get the latest code
git pull

# 2. Update the database (does nothing if there are no model changes)
python manage.py migrate

# 3. Update CSS/JS (type 'yes' if it asks to overwrite)
python manage.py collectstatic

# 4. Reload the Python code
sudo systemctl restart gunicorn