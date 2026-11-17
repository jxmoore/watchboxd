// Fallback links when JustWatch has no direct link: open the service's own search for the title.
// Matched on TMDB's provider name. Services not listed here get no link (the card's "Watch options" still works).

type Rule = [RegExp, (q: string) => string];

const RULES: Rule[] = [
  // Add-on channels sold through Amazon / Apple live in those apps, so search there.
  [/amazon channel$/i, (q) => `https://www.amazon.com/s?k=${q}&i=instant-video`],
  [/apple tv channel$/i, (q) => `https://tv.apple.com/search?term=${q}`],

  [/^netflix/i, (q) => `https://www.netflix.com/search?q=${q}`],
  [/^tubi/i, (q) => `https://tubitv.com/search/${q}`],
  [/^amazon (prime )?video|^amazon prime/i, (q) => `https://www.amazon.com/s?k=${q}&i=instant-video`],
  [/^apple tv/i, (q) => `https://tv.apple.com/search?term=${q}`],
  [/^hulu/i, (q) => `https://www.hulu.com/search?q=${q}`],
  [/^(hbo )?max/i, (q) => `https://play.max.com/search?q=${q}`],
  [/^disney/i, (q) => `https://www.disneyplus.com/search?q=${q}`],
  [/^peacock/i, (q) => `https://www.peacocktv.com/search?q=${q}`],
  [/^paramount/i, (q) => `https://www.paramountplus.com/search/?q=${q}`],
  [/^plex/i, (q) => `https://watch.plex.tv/search?q=${q}`],
  [/^pluto/i, (q) => `https://pluto.tv/search/details?query=${q}`],
  [/^the roku channel|^roku/i, (q) => `https://therokuchannel.roku.com/search/${q}`],
  [/^kanopy/i, (q) => `https://www.kanopy.com/en/search?query=${q}`],
  [/^hoopla/i, (q) => `https://www.hoopladigital.com/search?q=${q}&type=direct`],
  [/^youtube/i, (q) => `https://www.youtube.com/results?search_query=${q}`],
  [/^google play/i, (q) => `https://play.google.com/store/search?q=${q}&c=movies`],
  [/^fandango|^vudu/i, (q) => `https://athome.fandango.com/content/browse/search?searchString=${q}`],
  [/^mubi/i, (q) => `https://mubi.com/en/search/films?query=${q}`],
  [/^(the )?criterion/i, (q) => `https://www.criterionchannel.com/search?q=${q}`],
  [/^shudder/i, (q) => `https://www.shudder.com/search?q=${q}`],
  [/^philo/i, (q) => `https://www.philo.com/player/search?q=${q}`],
  [/^fubo/i, (q) => `https://www.fubo.tv/search?q=${q}`],
  [/^crackle/i, (q) => `https://www.crackle.com/search?query=${q}`],
  [/^amc\+|^amc plus/i, (q) => `https://www.amcplus.com/search?q=${q}`],
  [/^starz/i, (q) => `https://www.starz.com/us/en/search?q=${q}`],
  [/^mgm\+/i, (q) => `https://www.mgmplus.com/search?q=${q}`],
  [/^microsoft store/i, (q) => `https://www.microsoft.com/en-us/search/shop/movies?q=${q}`],
];

export function searchLink(providerName: string, title: string): string | null {
  const q = encodeURIComponent(title);
  for (const [re, build] of RULES) if (re.test(providerName)) return build(q);
  return null;
}
