import os
import time
import random
import json
import logging
import redis

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ML-Simulator")

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
logger.info(f"Connecting to Redis at: {REDIS_URL}")
r = redis.from_url(REDIS_URL)

# Departments and their centroid coordinates on a 100x100 grid
DEPARTMENTS = {
    "Entrance Portal": {"x": 10, "y": 10},
    "Makeup Section": {"x": 30, "y": 45},
    "Skin Section": {"x": 65, "y": 45},
    "Bath & Body Section": {"x": 50, "y": 80},
    "Checkout Counter": {"x": 85, "y": 20}
}

# Names of customers we can simulate to match the dataset style
NAMES = [
    "Aanya Sharma", "Rahul Verma", "Sneha Patel", "Amit Singh", "Priya Nair",
    "Vikram Rao", "Neha Gupta", "Rohan Das", "Anjali Mehta", "Aditya Joshi",
    "Divya Iyer", "Sanjay Kumar", "Kiran Reddy", "Tanvi Sen", "Varun Malhotra"
]

class SimulatedShopper:
    def __init__(self, shopper_id):
        self.id = shopper_id
        self.name = random.choice(NAMES) + f" ({shopper_id[-4:]})"
        self.x = DEPARTMENTS["Entrance Portal"]["x"]
        self.y = DEPARTMENTS["Entrance Portal"]["y"]
        self.start_time = time.time()
        self.current_dept = "Entrance Portal"
        # Path of departments the shopper plans to visit
        num_visits = random.randint(1, 3)
        depts = ["Makeup Section", "Skin Section", "Bath & Body Section"]
        random.shuffle(depts)
        self.path = depts[:num_visits] + ["Checkout Counter"]
        self.target_index = 0
        self.steps_in_current_dept = 0

    def step(self):
        # Move towards the current target department
        target_dept = self.path[self.target_index]
        target_coords = DEPARTMENTS[target_dept]
        
        # Calculate direction
        dx = target_coords["x"] - self.x
        dy = target_coords["y"] - self.y
        dist = (dx**2 + dy**2)**0.5
        
        if dist < 4:
            # Arrived at department, stay there for a bit
            self.current_dept = target_dept
            self.steps_in_current_dept += 1
            # Add some jitter while standing in the department
            self.x += random.uniform(-2, 2)
            self.y += random.uniform(-2, 2)
            
            # Spend 2-4 simulation steps in a department before moving on
            if self.steps_in_current_dept >= random.randint(2, 5):
                self.steps_in_current_dept = 0
                self.target_index += 1
                if self.target_index >= len(self.path):
                    return True # Shopper has finished checkout and leaves
        else:
            # Move towards target
            step_size = random.uniform(5, 8)
            self.x += (dx / dist) * step_size
            self.y += (dy / dist) * step_size
            # Add small random noise to make the path look organic
            self.x += random.uniform(-1, 1)
            self.y += random.uniform(-1, 1)
            self.current_dept = "Moving..."
            
        # Constrain to grid boundaries
        self.x = max(2, min(98, self.x))
        self.y = max(2, min(98, self.y))
        return False

def main():
    shoppers = {}
    shopper_counter = 1000
    
    # Wait for Redis to be ready
    for i in range(10):
        try:
            r.ping()
            logger.info("Successfully connected to Redis!")
            break
        except redis.ConnectionError:
            logger.warning("Redis not ready yet. Retrying in 2 seconds...")
            time.sleep(2)
    else:
        logger.error("Failed to connect to Redis. Exiting.")
        return

    logger.info("Starting Vision Simulation loop...")
    while True:
        try:
            # 1. Randomly decide to spawn a new shopper (up to max 12 shoppers in store)
            if len(shoppers) < 8 and random.random() < 0.35:
                shopper_counter += 1
                sid = f"SH-{shopper_counter}"
                shopper = SimulatedShopper(sid)
                shoppers[sid] = shopper
                
                # Publish entry event
                event = {
                    "type": "entry",
                    "shopper_id": shopper.id,
                    "name": shopper.name,
                    "x": shopper.x,
                    "y": shopper.y,
                    "timestamp": time.time()
                }
                r.publish("store_events", json.dumps(event))
                logger.info(f"Shopper {shopper.name} entered the store.")

            # 2. Progress all active shoppers
            exited_shoppers = []
            for sid, shopper in shoppers.items():
                is_finished = shopper.step()
                if is_finished:
                    # Shopper exited
                    exited_shoppers.append(sid)
                    dwell_time = time.time() - shopper.start_time
                    # Let's scale dwell time so 1 second = 1 minute of dwell time in metrics
                    dwell_minutes = round((dwell_time * 1.5), 1)
                    
                    event = {
                        "type": "exit",
                        "shopper_id": shopper.id,
                        "name": shopper.name,
                        "dwell_time_minutes": dwell_minutes,
                        "timestamp": time.time()
                    }
                    r.publish("store_events", json.dumps(event))
                    logger.info(f"Shopper {shopper.name} exited store. Dwell time: {dwell_minutes} mins.")
                else:
                    # Update coordinate event
                    event = {
                        "type": "move",
                        "shopper_id": shopper.id,
                        "name": shopper.name,
                        "x": round(shopper.x, 2),
                        "y": round(shopper.y, 2),
                        "department": shopper.current_dept,
                        "timestamp": time.time()
                    }
                    r.publish("store_events", json.dumps(event))

            # Remove exited shoppers
            for sid in exited_shoppers:
                if sid in shoppers:
                    del shoppers[sid]

            # Sleep to pace the simulation (1.5 seconds gives smooth updates)
            time.sleep(1.5)
            
        except Exception as e:
            logger.error(f"Error in simulation loop: {str(e)}")
            time.sleep(2)

if __name__ == "__main__":
    main()
