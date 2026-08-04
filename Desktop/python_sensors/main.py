import sys
import os
import time
import argparse

# Insert Desktop/ folder (parent of python_sensors) so 'from python_sensors.x import y' works
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from python_sensors.controllers.sensorController import SensorController

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PROCTR Background OS Sensor Engine (MVC Backend)")
    parser.add_argument("--exam_id", type=int, default=1, help="Exam ID")
    parser.add_argument("--student_id", type=int, default=101, help="Student ID")
    parser.add_argument("--whitelist", type=str, default="", help="Comma-separated whitelisted processes")

    args = parser.parse_args()

    custom_whitelist = [p.strip() for p in args.whitelist.split(",") if p.strip()] if args.whitelist else None

    controller = SensorController(
        exam_id=args.exam_id,
        student_id=args.student_id,
        custom_whitelist=custom_whitelist
    )

    controller.start()

    try:
        while True:
            time.sleep(1.0)
    except KeyboardInterrupt:
        controller.stop()
