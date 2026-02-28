from fastapi import FastAPI

app = FastAPI()

@app.get("/challenge")
def get_challenge():
    return {
        "code": "def add(a, b):\n    return a - b",  # the buggy code to show
        "file": "/home/user/project/main.py",         # file to jump to on success
        "line": 42,                                    # line to jump to on success
        "countdownSeconds": 30
    }

@app.get("/check")
def check_solution():
    # your logic here to determine if the bug is fixed
    # could check a file, run tests, query a db, anything
    return { "solved": False }

@app.get("/punishment")
def get_punishment():
    import random
    punishments = [
        "TWENTY PUSHUPS NOW SOLDIER!",
        "YOU CALL THAT CODE?! START OVER!",
        "MY GRANDMOTHER CODES FASTER THAN YOU!",
    ]
    return { "punishment": random.choice(punishments) }