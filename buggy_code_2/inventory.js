/**
 * Grade Book - Calculates final grades for a class of students.
 *
 * Policy:
 *   - Each student has scores in three categories: homework, quizzes, exams.
 *   - The lowest score in each category is dropped before averaging.
 *   - Weighted average: homework 30%, quizzes 30%, exams 40%.
 *   - A curve of +5 points is applied to every student's final grade.
 *
 * Expected output for the sample roster:
 *   Alice  → ~91.17  (before curve → ~86.17)
 *   Bob    → ~80.83  (before curve → ~75.83)
 *   Carlos → ~88.33  (before curve → ~83.33)
 */

const WEIGHTS = { homework: 0.30, quizzes: 0.30, exams: 0.40 };
const CURVE = 5;

const roster = [
    {
        name: "Alice",
        homework: [90, 85, 100, 92],
        quizzes:  [80, 95, 88],
        exams:    [78, 92],
    },
    {
        name: "Bob",
        homework: [70, 65, 80, 74],
        quizzes:  [60, 85, 72],
        exams:    [88, 70],
    },
    {
        name: "Carlos",
        homework: [95, 88, 76, 90],
        quizzes:  [90, 70, 85],
        exams:    [80, 82],
    },
];

/**
 * Drops the lowest score from an array and returns the average of what remains.
 */
function averageWithDropLowest(scores) {
    scores.sort((a, b) => a - b);   // sort ascending so lowest is first
    scores.shift();                   // remove the lowest
    const sum = scores.reduce((acc, s) => acc + s, 0);
    return sum / scores.length;
}

/**
 * Computes the weighted final grade (before curve) for one student.
 */
function computeFinalGrade(student) {
    const hwAvg   = averageWithDropLowest(student.homework);
    const qzAvg   = averageWithDropLowest(student.quizzes);
    const examAvg = averageWithDropLowest(student.exams);

    return (hwAvg * WEIGHTS.homework)
         + (qzAvg * WEIGHTS.quizzes)
         + (examAvg * WEIGHTS.exams);
}

/**
 * Processes each student, applies the curve, and returns a results array.
 * Uses a spread copy of the roster so we don't mutate the original data.
 */
function processGrades(students) {
    const copy = [...students];       // "copy" of the roster

    return copy.map(student => {
        const raw   = computeFinalGrade(student);
        const curved = Math.min(raw + CURVE, 100);
        return { name: student.name, raw: raw.toFixed(2), curved: curved.toFixed(2) };
    });
}

// === Run ===

console.log("--- First Run ---");
const results1 = processGrades(roster);
results1.forEach(r => console.log(`  ${r.name}: ${r.curved} (before curve: ${r.raw})`));

console.log("\n--- Second Run (should be identical) ---");
const results2 = processGrades(roster);
results2.forEach(r => console.log(`  ${r.name}: ${r.curved} (before curve: ${r.raw})`));
