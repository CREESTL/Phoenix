const nerdamer = require("nerdamer/all.min")

// Find a derivative
// Normalize values
let pol = nerdamer('(997 * x * 0.380000) / (0.060000 * 1000 + x * 997) - x');
let der = nerdamer.diff(pol);
console.log("Derivative is: ", der.text());
// Find the roots of the derivative
x = nerdamer.solve(`${der}`, 'x');
console.log("All roots are: ", x.text().split(","));
console.log("Number of roots: ", x.text().split(",").length);
// Result is string. Split it in two parts.
let [root1, root2] = x.text().split(",");
// Get rid of brackets
root1 = root1.replace('[', '');
root2 = root2.replace(']', '');
// Convert to numbers
root1 = Number(root1);
root2 = Number(root2);
console.log("root 1 is ", root1);
console.log("root 2 is ", root2);
let biggest = root1 > root2 ? root1 : root2;
// Biggest root of first derivative
// NOTE It is always the point of maximum value of the function
// No need to search for the second derivative
console.log("biggest is: ", biggest);