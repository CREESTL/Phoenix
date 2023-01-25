const FEE = 0.997;

// returns number of decimals of the biggest number
const getDecimalCount = (x, y) => {
    let max = Math.max(x, y);
    return max.toString().length
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
    let root1 = (Math.sqrt(FEE*r0*r1) - r0)/FEE;
    let root2 = (Math.sqrt(FEE*r0*r1)*(-1) - r0)/FEE;
    let optimalAmount =  Math.max(root1, root2);
    if(optimalAmount < 0)
        throw "error";
    return Math.floor(optimalAmount * 1e6);
}

