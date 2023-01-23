# Binimoal Distirbution Interactive
Toy simulation of flipping coins many times to approach the expected distribution.

## Conditions
* `n` The number of flips per trail
* `p` The probability of a coin flip coming up heads

## Controls
* Flip Coin - click to flip just one coin
* Pause/play/reset
* Trials / s. Controls target number of _trials_ to run every second. This translates to `n * trials/s` coins/s.
* Performance breaks down around 10 million coin flips/s or so.

## Computation
### Factorial
A naive factorial function using native double floats in JavaScript will break down around 171! because it will exceed max value of `1.8e308`. While we could use BigNumber, we'll still hit numerical limits when using multiplication and division.

### Choose
While `n` is within numerical limits (~170), opt for the exact calculation. When `n` is larger, switch to the two order appoximation instead.

For `n` larger than ~1000, we hit result values beyond numerical limits.(1000 choose 500) = `2.7e299`. To allow for larger values, we use calculate the log of choose. Since we're interested in the binomal probability distribution, we don't have to convert back to linear pdf scale [0, 1] until after logPDF is calculated [-inf, 0].


