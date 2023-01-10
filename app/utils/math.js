//Uniswap fee 0.3%
const FEE = 0.003;
//We don't want to affect the price more than 0.005%
const MAX_PRICE_IMPACT = 0.0005;

// returns number of decimals of the biggest number
const getDecimalCount = (x, y) => {
    let max = Math.max(x, y);
    return max.toString().length
}
// returns number of decimals after decimal part in fixed point number
exports.getDecimalsAfterPoint = (x) => {
    console.log(x)
    let value = Math.abs(x);
    let s = value.toString().split('.')
    console.log(s)
    if(s.length == 1)
      return 0;
    return s[1].length;
}

// calculate optimal tradeable amount for the given token
exports.calcOptimalSwapAmount = (reserve) => {
    let optimalAmount = reserve * MAX_PRICE_IMPACT / ((1 - MAX_PRICE_IMPACT)*(1 - FEE));
    return Math.floor(optimalAmount);
}

