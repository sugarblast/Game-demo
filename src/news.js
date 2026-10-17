// News + humor content. Tokens: {p} = pathogen name, {r} = region name, {n} = a number.
// Rules for ALL lines: satire aimed at systems, companies, habits and trends. Never real people, parties,
// religions, nationalities or stereotypes (a {r} token can be ANY region, so jokes must work everywhere).
const NEWS = {
  ticker: {
    zero: [
      'Patient zero falls ill in {r}. Says it is "just allergies."',
      'A mystery cough begins in {r}. Coworkers assume it is dramatic.',
      'Patient zero in {r} insists on "powering through." Group chat disapproves.',
    ],
    air: [
      '{p} reaches {r} by air. Window seat, no baggage fee.',
      '{p} lands in {r} with carry-on only. Skips the customs line, somehow.',
      'A very friendly passenger brings {p} to {r}. Seat 14C is "so sorry."',
    ],
    sea: [
      '{p} reaches {r} aboard a cargo ship. Stowaway was not on the manifest.',
      'A shipping container delivers {p} to {r}, plus 400 yoga mats.',
      '{p} arrives in {r} by sea. Port inspectors were "about to take a lunch break."',
    ],
    land: [
      '{p} crosses into {r} by road. Heavy traffic made it late.',
      '{p} walks into {r}. The border sign says "please wash your hands." It does not comply.',
      '{p} reaches {r} overland, riding a delayed bus like everyone else.',
    ],
    death: [
      'First deaths confirmed in {r}. Officials request calm and a 12-step plan.',
      '{r} reports its first fatalities. A press conference is scheduled for "soon."',
      'First deaths in {r}. Official statement: "We are monitoring the situation." They were not.',
    ],
    detect: [
      'Doctors in {r} identify a new disease. Group chat panics.',
      '{r} health ministry: "We have seen worse." They had not.',
      '{r} detects {p}. Search for "is this normal" hits a record high.',
    ],
    closeB: [
      '{r} closes its land borders. Travel influencers weep.',
      '{r} seals the borders. Customs says the stamp is "emotionally exhausted."',
    ],
    closeA: [
      '{r} shuts its airports. Duty-free sales plummet.',
      '{r} grounds all flights. Frequent flyer miles now worth less than a coupon.',
    ],
    closeS: [
      '{r} closes its ports. Ships anchor in a very expensive parking lot.',
      '{r} shuts the harbor. Cargo containers begin a long, awkward wait.',
    ],
    lock: [
      '{r} enters lockdown. Sourdough starters are spotted again.',
      '{r} locks down. Video call backgrounds are suddenly "very important."',
    ],
    cure25: ['Cure research is 25% complete. Scientists are "cautiously optimistic" and low on coffee.'],
    cure50: ['Cure research hits 50%. Funding request is stuck in a pending-approval tab.'],
    cure75: ['Cure enters final trials. The consent form is 48 pages and nobody reads it.'],
    sab: [
      'A lab freezer fails. The cure sample is now "technically a smoothie."',
      'Research data lost in a reply-all with a 4 GB attachment.',
      'Key trial delayed by a form needing three signatures and one notary.',
      'A rumor about cure side effects slows trials. Source: a very confident podcast.',
      'Lab orders 10,000 pipette tips. A spreadsheet typo delivers 10,000,000.',
    ],
    hintCold: ['{p} struggles in the cold of {r}. Cold resistance would help here.'],
    hintHot: ['{p} wilts in the heat of {r}. Heat resistance would help here.'],
    winEnd: ['The last human sneezes. {p} reviews itself: 5 stars.'],
    loseEnd: ['A cure is deployed worldwide. Pharma announces a premium version.'],
    burnEnd: ['{p} burned out. Reportedly "tired of the commute."'],
  },
  // Breaking news interrupts: h = headline, s = subline. These pause the game until dismissed.
  brk: {
    detect1: [
      { h: 'Mystery illness spotted in {r}', s: 'Doctors say it is "probably nothing", which is what doctors say right before it is something.' },
      { h: '{r} reports cases of "something going around"', s: 'Officials assure the public this is "a normal amount of mysterious."' },
    ],
    death1: [
      { h: 'First fatalities attributed to {p}', s: 'Officials urge everyone to "remain calm and keep scrolling."' },
      { h: 'First deaths linked to new disease', s: 'The hashtag #NotAgain trends for eleven minutes, then a celebrity feud takes over.' },
    ],
    inf_100k: [
      { h: '100,000 infected and counting', s: 'The group chat now has a dedicated outbreak channel and a muted work channel.' },
    ],
    inf_10m: [
      { h: '10 million infected', s: '"It is just a cold," says everyone who did not check.' },
    ],
    inf_1b: [
      { h: 'One billion infected', s: 'Calendars cleared worldwide. Shareholders are "monitoring the situation."' },
    ],
    dead_1m: [
      { h: 'One million lives lost', s: 'Officials hold a minute of silence, then a 90-minute press conference.' },
    ],
    dead_100m: [
      { h: '100 million lives lost', s: 'Global spreadsheets are "struggling to keep up." Software update requested.' },
    ],
    dead_1b: [
      { h: 'One billion lives lost', s: 'Remaining humans report feeling "quiet." Streaming service raises prices anyway.' },
    ],
    cure25: [
      { h: 'Cure research reaches 25%', s: 'Scientists are "cautiously optimistic", which in lab terms means "we need more coffee."' },
    ],
    cure50: [
      { h: 'Humanity is halfway to a cure', s: 'Researchers beg for funding. The funding is stuck in a pending-approval tab.' },
    ],
    cure75: [
      { h: 'Cure enters final trials', s: 'Panic buying resumes. Nobody remembers why they need 80 rolls of paper towels.' },
    ],
    regions10: [
      { h: '{p} confirmed in 10 regions', s: 'Travel advisory: "Maybe don\'t."' },
    ],
    regions25: [
      { h: '{p} spreads to 25 regions', s: 'Map makers run out of red. A local crayon shortage is reported.' },
    ],
    regions40: [
      { h: '{p} is nearly everywhere', s: 'The last uninfected places are being "surprisingly smug about it."' },
    ],
    close1: [
      { h: '{r} slams its borders shut', s: 'Tourism board: "We are open. To a different time."' },
    ],
    sab1: [
      { h: 'Mysterious lab mishap delays cure', s: 'Officials blame "a gremlin" and an unplugged power strip.' },
    ],
    random: [
      { h: 'Experts urge calm. Also panic. Also say "it is complicated."', s: 'A panel of twelve experts reached consensus: hold another panel.' },
      { h: 'Startup claims AI can cure {p}', s: 'Investors thrilled. Product is a chatbot in a lab coat. Demo scheduled for "soon."' },
      { h: 'Streaming service raises prices again to "support outbreak content"', s: 'Subscribers can now watch the world end in 4K for $24.99 a month. With ads.' },
      { h: 'Billionaire pledges to personally solve {p}', s: 'Pledge is "conditional on a tax break and a podcast appearance."' },
      { h: 'Wellness influencer says {p} can be beaten with a morning routine', s: 'Step one: wake at 4:30 AM. Step two: sell a $90 candle.' },
      { h: 'Companies order staff back to office to "fight {p} with culture"', s: 'Return-to-office memo cites "synergy." Germs agree.' },
      { h: 'Rents hit a record as landlords cite "unprecedented germ demand"', s: 'A studio with a mold-based ecosystem is listed at $2,900.' },
      { h: 'Airline introduces fee for "breathing during takeoff"', s: 'Seat selection still extra. Legroom is now a premium subscription.' },
      { h: 'Delivery app fees hit $14 for a single banana', s: 'Officials call it "the new normal." The banana was reportedly overripe.' },
      { h: 'Nation doomscrolls for 11 hours, reports feeling "informed"', s: 'Nobody can name a single fact, but everyone has 14 opinions.' },
      { h: 'Cereal makers confirm boxes are now 80% air', s: 'Shrinkflation experts note the irony of an airborne pathogen.' },
      { h: 'Smart fridge demands a subscription to keep leftovers cold', s: 'Owners report lasagna "held hostage" pending $9.99 a month.' },
      { h: 'Cookie banner accepted by 100% of humanity', s: 'The "reject all" button is reportedly still at the bottom of the internet.' },
      { h: 'Meeting that could have been an email scheduled to discuss {p}', s: '47 attendees, one agenda item, and a "please read ahead" nobody read.' },
      { h: 'New password rule: a capital, a symbol, and a will to live', s: 'Support suggests turning civilization off and on again.' },
      { h: 'Crypto fans launch $PLAGUE coin', s: 'Market cap swings wildly between lunch and dinner. The whitepaper is a meme.' },
      { h: 'Self-checkout reports "unexpected item in bagging area"', s: 'The item was {p}. The attendant is "on break, indefinitely."' },
      { h: 'Concert tickets sell out in 9 seconds', s: 'Final price: $300 plus a $212 "convenience fee." Convenience not included.' },
      { h: 'Tech company lays off 4,000 by email, calls it "an exciting next chapter"', s: 'The email contained three emojis and zero severance details.' },
      { h: 'Family group chat has 214 unread messages about {p}', s: 'Nobody has read them. One uncle is certain he knows a guy.' },
      { h: 'Coffee shop adds "sanitation surcharge" on top of oat milk surcharge', s: 'The latte is now $9. It includes a free inspirational quote about resilience.' },
      { h: 'Government outbreak website crashes under "unprecedented demand"', s: 'It was a Tuesday. The demand was eleven people and a bot.' },
      { h: 'Traffic worse than ever despite fewer people on the road', s: 'Experts call it a mystery. The mystery is one lane closure.' },
      { h: 'Drug maker promises cure will be "affordable"', s: 'Price will be announced in a 48-page PDF. Terms apply.' },
      { h: 'Social app launches a feature nobody asked for', s: 'It is a button labeled "Panic." Engagement is up 400%.' },
      { h: 'Officials call mask guidelines "perfectly clear"', s: 'The guidelines have been updated 17 times since breakfast.' },
      { h: 'Gym memberships spike as world resolves to "get fit, then get cured"', s: 'Gyms promise to honor your cancellation in 6 to 8 business years.' },
      { h: 'Scientists confirm germs do not respect personal space', s: 'Public transit riders say they could have told them that for free.' },
      { h: 'Hashtags confirmed ineffective against {p}', s: 'Neither are slogans, petitions, or a firmly worded email to "customer care."' },
      { h: 'New study: 87% of statistics are made up on the spot', s: 'Researchers are "73% sure" about this one.' },
      { h: 'Wi-Fi goes down at the emergency summit', s: 'World leaders are forced to speak in person. Chaos ensues.' },
      { h: 'Pet owner insists dog "definitely has {p}"', s: 'Vet says it is gas. The owner has already started a fundraiser.' },
      { h: 'Home-buying guide: first-time buyers now average 94 years old', s: '"It is cozy," says one, from a 300-square-foot starter home.' },
    ],
  },
};

// Optional extra content dropped in by the Writers' Room helper chat (assets/content/extra.js)
(function mergeExtra() {
  const X = (typeof window !== 'undefined' && window.OUTBREAK_CONTENT) || null;
  if (!X) return;
  const okStr = s => typeof s === 'string' && s.length > 3 && s.length < 400;
  if (X.ticker) for (const k of Object.keys(X.ticker)) {
    if (!Array.isArray(X.ticker[k])) continue;
    NEWS.ticker[k] = (NEWS.ticker[k] || []).concat(X.ticker[k].filter(okStr));
  }
  if (X.breaking) for (const k of Object.keys(X.breaking)) {
    if (!Array.isArray(X.breaking[k])) continue;
    NEWS.brk[k] = (NEWS.brk[k] || []).concat(X.breaking[k].filter(o => o && okStr(o.h) && okStr(o.s)));
  }
})();

// Text RNG is separate from the simulation RNG so jokes never change gameplay outcomes.
function tnext(st) { st.ts = (Math.imul(st.ts | 0, 1664525) + 1013904223) >>> 0; return st.ts / 4294967296; }
function fillTokens(s, v) { return s.replace(/\{(\w+)\}/g, (m, k) => (v && v[k] !== undefined ? v[k] : '')); }
function tline(st, key, v) {
  const arr = NEWS.ticker[key]; if (!arr || !arr.length) return '';
  return fillTokens(arr[Math.floor(tnext(st) * arr.length)], Object.assign({ p: st.name }, v));
}
function makeBreak(st, type, v) {
  const arr = NEWS.brk[type]; if (!arr || !arr.length) return null;
  let idx;
  if (type === 'random') {
    st.usedBrk = st.usedBrk || [];
    if (st.usedBrk.length >= arr.length) st.usedBrk = [];
    do { idx = Math.floor(tnext(st) * arr.length); } while (st.usedBrk.includes(idx));
    st.usedBrk.push(idx);
  } else idx = Math.floor(tnext(st) * arr.length);
  const o = arr[idx], vars = Object.assign({ p: st.name }, v);
  return { type, h: fillTokens(o.h, vars), s: fillTokens(o.s, vars), r: (v && v.r) || '' };
}
