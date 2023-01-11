//Uniswap fee 0.3%
const FEE = 0.003;
//We don't want to affect the price more than 0.05%
const MAX_PRICE_IMPACT = 0.0005;

// returns number of decimals of the biggest number
const getDecimalCount = (x, y) => {
    let max = Math.max(x, y);
    return max.toString().length
}
// calculates quadratic equation
const calcQuadraticEquation = (a, b, c) => {
    let D = b*b - 4*a*c;
    let root1 = (b*(-1) - Math.sqrt(D))/2*a;
    let root2 = (b*(-1) + Math.sqrt(D))/2*a;
    return Math.max(root1, root2);
}
// returns number of decimals after decimal part in fixed point number
exports.getDecimalsAfterPoint = (x) => {
    let value = Math.abs(x);
    let s = value.toString().split('.')
    if(s.length == 1)
      return 0;
    return s[1].length;
}
// calculate optimal tradeable amount for the given token
exports.calcOptimalSwapAmount = (reserve0, reserve1) => {
    let r0 = reserve0 / 1e6;
    let r1 = reserve1 / 1e6;
    let optimalAmount = calcQuadraticEquation(1, 2*r0, r0*r0 - r0*r1);
    return Math.floor(optimalAmount * 1e6);
}

