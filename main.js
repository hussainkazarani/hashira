'use strict';
const fs = require('fs');

// Convert a single digit character to its numeric value (supports 0-9 and a-z)
function charToDigit(ch) {
    if (ch >= '0' && ch <= '9') return ch.charCodeAt(0) - 48;
    const lower = ch.toLowerCase();
    if (lower >= 'a' && lower <= 'z') return lower.charCodeAt(0) - 87;
    throw new Error(`Invalid digit '${ch}'`);
}

// Convert a string representing a number in a given base (2 to 36) to BigInt
function parseBigIntFromBase(str, base) {
    if (typeof str !== 'string') throw new Error('Input value must be a string');
    const b = Number(base);
    if (!Number.isInteger(b) || b < 2 || b > 36) {
        throw new Error(`Base ${b} not supported. Must be between 2 and 36.`);
    }

    let s = str.trim();
    let negative = false;
    if (s.startsWith('-')) {
        negative = true;
        s = s.slice(1);
    }

    let result = 0n;
    const bigBase = BigInt(b);
    for (const ch of s) {
        const digit = charToDigit(ch);
        if (digit >= b) throw new Error(`Digit '${ch}' not valid for base ${b}`);
        result = result * bigBase + BigInt(digit);
    }

    return negative ? -result : result;
}

// Solve a system of linear equations with rational numbers using Gaussian elimination
// Matrix is an array of arrays, each row has coefficients followed by constant term
function solveLinearEquations(matrix) {
    const n = matrix.length;
    const m = matrix[0].length;

    // Represent fractions as { num: numerator (BigInt), den: denominator (BigInt) }
    const makeFraction = (num, den = 1n) => ({ num, den });

    // Compute gcd for simplifying fractions
    const gcd = (a, b) => (b === 0n ? a : gcd(b, a % b));
    const abs = (x) => (x < 0n ? -x : x);

    // Simplify fraction by dividing numerator and denominator by gcd
    const simplify = (f) => {
        let g = gcd(abs(f.num), abs(f.den));
        if (f.den < 0n) g = -g;
        return { num: f.num / g, den: f.den / g };
    };

    // Fraction arithmetic
    const add = (a, b) => simplify({ num: a.num * b.den + b.num * a.den, den: a.den * b.den });
    const subtract = (a, b) => simplify({ num: a.num * b.den - b.num * a.den, den: a.den * b.den });
    const multiply = (a, b) => simplify({ num: a.num * b.num, den: a.den * b.den });
    const divide = (a, b) => simplify({ num: a.num * b.den, den: a.den * b.num });

    // Convert matrix entries to fractions
    let mat = matrix.map((row) => row.map((v) => makeFraction(v)));

    for (let col = 0; col < n; col++) {
        // Find pivot row with non-zero value in current column
        let pivotRow = col;
        for (let r = col; r < n; r++) {
            if (mat[r][col].num !== 0n) {
                pivotRow = r;
                break;
            }
        }

        // Swap pivot row to current row
        if (pivotRow !== col) {
            [mat[col], mat[pivotRow]] = [mat[pivotRow], mat[col]];
        }

        // Normalize pivot row so pivot element becomes 1
        const pivotValue = mat[col][col];
        for (let c = col; c < m; c++) {
            mat[col][c] = divide(mat[col][c], pivotValue);
        }

        // Eliminate current column in all other rows
        for (let r = 0; r < n; r++) {
            if (r === col) continue;
            const factor = mat[r][col];
            for (let c = col; c < m; c++) {
                mat[r][c] = subtract(mat[r][c], multiply(factor, mat[col][c]));
            }
        }
    }

    // Extract solution (last column) and simplify
    return mat.map((row) => simplify(row[m - 1]));
}

// Main program execution
if (process.argv.length < 3) {
    console.error('Usage: node polynomial_solver.js <input.json>');
    process.exit(1);
}

const inputFilePath = process.argv[2];
const inputData = JSON.parse(fs.readFileSync(inputFilePath, 'utf8'));

const numPoints = inputData.keys.n;
const degreePlusOne = inputData.keys.k; // number of points used, polynomial degree = k - 1

let dataPoints = [];
for (const key of Object.keys(inputData)) {
    if (key === 'keys') continue;
    const xVal = BigInt(key);
    const baseVal = parseInt(inputData[key].base, 10);
    const yVal = parseBigIntFromBase(inputData[key].value, baseVal);
    dataPoints.push({ x: xVal, y: yVal });
}

// Only use first k points for interpolation
dataPoints = dataPoints.slice(0, degreePlusOne);

let matrix = [];
const degree = degreePlusOne - 1;
// Construct system of linear equations for polynomial coefficients
// Each row: [x^degree, x^(degree-1), ..., x^0, y]
for (const point of dataPoints) {
    let row = [];
    for (let power = degree; power >= 0; power--) {
        row.push(point.x ** BigInt(power));
    }
    row.push(point.y);
    matrix.push(row);
}

const coefficients = solveLinearEquations(matrix);
const constantTerm = coefficients[coefficients.length - 1];

if (constantTerm.den !== 1n) {
    console.warn('Warning: constant term is fractional!');
}

// Output the constant term numerator (integer part)
console.log(constantTerm.num.toString());
