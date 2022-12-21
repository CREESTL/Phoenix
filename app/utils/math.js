const nerdamer = require("nerdamer/all.min")

// returns number of decimals of the biggest number
const getDecimalCount = (x, y) => {
    let max = Math.max(x, y);
    return max.toString().length
}

exports.calcOptimalSwapAmount = (reserveA, reserveB) => {
    // Prepare numbers for the nerdamer 
    let decimals = getDecimalCount(reserveA, reserveB);
    reserveA = Math.floor(reserveA/10**decimals * 10000)/10000;
    reserveB = Math.floor(reserveB/10**decimals * 10000)/10000;
    // Find a derivative
    // Normalize values
    let pol = nerdamer(`(997 * x * ${reserveA}) / (${reserveB} * 1000 + x * 997) - x`);
    let der = nerdamer.diff(pol);
    // Find the roots of the derivative
    x = nerdamer.solve(`${der}`, 'x');

    if(x.text().split(",").length > 2)
        throw("Yikes! Bad calculation results, cancelling the swap")

    // Result is string. Split it in two parts.
    let [root1, root2] = x.text().split(",");
    // Get rid of brackets
    root1 = root1.replace('[', '');
    root2 = root2.replace(']', '');
    // Convert to numbers
    root1 = Number(root1);
    root2 = Number(root2);
    result = root1 > root2 ? root1 : root2;
    // Biggest root of first derivative
    // NOTE It is always the point of maximum value of the function
    // No need to search for the second derivative
    return Math.floor(result * 10**decimals);
}

