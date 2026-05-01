# Coorda

Coorda is a centralized worker management and automated scheduling application developed for the University of Arizona's THINK TANK. Designed specifically to handle the complex logistical needs of tutoring and Supplemental Instruction (SI) programs, the tool uniforms worker data and automates the process of generating complex semester schedules.

This project was developed as a university capstone project by Nathan Oswald, Noah Sherman, and Emily Austin.

## Key Features

* **Centralized Worker Data:** A unified platform to manage team members, assign specific courses/roles (e.g., CHEM 151, PSIO 202), and track individual status and quotas.
* **Automated Scheduling Engine:** Utilizes Google's OR-Tools (Constraint Programming) to automatically generate optimized schedules. The solver factors in worker availability, room capacities, fixed obligations (like student class schedules), and weekly shift quotas. It features a multi-phase fallback system to gracefully handle impossible scheduling constraints by relaxing quotas and returning shortfalls.
* **Interactive Supervisor Dashboard:** A drag-and-drop interface for supervisors to define room availability, set fixed scheduling obstructions, and manually tweak generated schedules.
* **Preference Collection & Heatmaps:** Generates shareable links to collect schedule preferences from attendees. Supervisors can view these aggregated preferences via a density heatmap to make data-driven scheduling decisions.

## Live Access

The production environment is currently hosted on University of Arizona networks. If you are connected to the campus network (or using the university VPN), you can access the application here:
[https://coorda.cs.arizona.edu/login](https://coorda.cs.arizona.edu/login)

## Local Development and Setup

If you need to run the project locally for development or testing, follow the instructions below. The project is built using Python and Django.

### Prerequisites
* Python 3.8 or higher
* pip (Python package installer)

### Installation Steps

1. **Clone the repository**
   Navigate to your desired directory and clone the project:
   ```bash
   git clone https://github.com/nao1000/Capstone-Project.git
   cd Capstone-Project
   ```

2. **Set up a virtual environment (Recommended)**
   It is best practice to use a virtual environment to manage dependencies.
   ```bash
   python -m venv venv
   
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. **Install dependencies**
   Install all required packages, including OR-Tools and Django, using the provided requirements file:
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up the database**
   Apply the Django migrations to set up your local database schema:
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```

5. **Create a superuser (Optional)**
   If you need access to the Django admin panel to configure initial teams, roles, or users:
   ```bash
   python manage.py createsuperuser
   ```

6. **Run the development server**
   Start the local server:
   ```bash
   python manage.py runserver
   ```
   You can now access the local instance at `http://127.0.0.1:8000`.

## Architecture Notes
* **Backend:** Django handles the core logic, database management (SQLite/PostgreSQL depending on environment), and API endpoints. The scheduling logic is heavily driven by `ortools.sat.python.cp_model`.
* **Frontend:** The UI relies on vanilla JavaScript for drag-and-drop scheduling, grid rendering, and asynchronous API calls to ensure a responsive, dynamic user experience without heavy frontend frameworks.