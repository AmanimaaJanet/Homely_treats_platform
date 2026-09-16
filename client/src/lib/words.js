/**
 * Amount in words, the way a receipt prints it.
 *
 * Ghanaian receipts carry both the figure and the words — it is what makes a paper
 * receipt defensible if a digit is ever disputed. Cedis and pesewas, no currency
 * library needed.
 */
export function amountInWords(amount) {
  const ones = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  const under1000 = (n) => {
    if (n < 20) return ones[n];
    if (n < 100) return `${tens[Math.floor(n / 10)]}${n % 10 ? `-${ones[n % 10]}` : ''}`;
    return `${ones[Math.floor(n / 100)]} hundred${n % 100 ? ` and ${under1000(n % 100)}` : ''}`;
  };

  const value = Math.abs(Number(amount) || 0);
  const whole = Math.floor(value);
  const pesewas = Math.round((value - whole) * 100);

  let words;
  if (whole === 0) words = 'zero';
  else if (whole < 1000) words = under1000(whole);
  else if (whole < 1000000) {
    words = `${under1000(Math.floor(whole / 1000))} thousand${whole % 1000 ? `, ${under1000(whole % 1000)}` : ''}`;
  } else {
    words = `${under1000(Math.floor(whole / 1000000))} million${whole % 1000000 ? `, ${under1000(whole % 1000000)}` : ''}`;
  }

  const cap = words.charAt(0).toUpperCase() + words.slice(1);
  const unit = whole === 1 ? 'Ghana cedi' : 'Ghana cedis';
  return `${cap} ${unit}${pesewas ? ` and ${under1000(pesewas)} pesewas` : ' only'}`;
}
