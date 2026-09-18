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

  /** 0–999,999 said properly: the "thousand" group, then the hundreds group. */
  const underMillion = (n) => {
    if (n < 1000) return under1000(n);
    const thousands = Math.floor(n / 1000);
    const rest = n % 1000;
    return `${under1000(thousands)} thousand${rest ? `, ${under1000(rest)}` : ''}`;
  };

  const parsed = Math.abs(Number(amount));
  const value = Number.isFinite(parsed) ? parsed : 0;
  const whole = Math.floor(value);
  const pesewas = Math.round((value - whole) * 100);

  let words;
  if (whole === 0) words = 'zero';
  else if (whole < 1000000) words = underMillion(whole);
  else {
    const millions = Math.floor(whole / 1000000);
    const rest = whole % 1000000;
    words = `${underMillion(millions)} million${rest ? `, ${underMillion(rest)}` : ''}`;
  }

  const cap = words.charAt(0).toUpperCase() + words.slice(1);
  const unit = whole === 1 ? 'Ghana cedi' : 'Ghana cedis';
  return `${cap} ${unit}${pesewas ? ` and ${under1000(pesewas)} pesewas` : ' only'}`;
}
