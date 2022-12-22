//Uniswap fee 0.3%
const FEE = 0.003;
//We don't want to affect the price more than 0.005%
const MAX_PRICE_IMPACT = 0.0005;

// returns number of decimals of the biggest number
const getDecimalCount = (x, y) => {
    let max = Math.max(x, y);
    return max.toString().length
}

// calculate optimal tradeable amount for the given token
exports.calcOptimalSwapAmount = (reserve) => {
    let optimalAmount = reserve * MAX_PRICE_IMPACT / ((1 - MAX_PRICE_IMPACT)*(1 - FEE));
    return Math.floor(optimalAmount);
}

