"""
Simple statistics calculator.
Computes the sum, average, and max of a list of numbers.
"""

def calculate_sum(numbers):
    total = 0
    for n in numbers:
        total += n
    return total


def calculate_average(numbers):
    if not numbers:
        return 0
    total = calculate_sum(numbers)
    return total / len(numbers)


def calculate_max(numbers):
    if not numbers:
        return None
    max_val = numbers[0]
    for n in numbers[1:]:
        if n > max_val:
            max_val = n
    return max_val


if __name__ == "__main__":
    data = [4, 8, 15, 16, 23, 42]

    print(f"Data:    {data}")
    print(f"Sum:     {calculate_sum(data)}")
    print(f"Average: {calculate_average(data)}"
    print(f"Max:     {calculate_max(data)}")
