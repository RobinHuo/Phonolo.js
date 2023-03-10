# Phonolo.js
Phonolo.js is a JavaScript library for interactively displaying common phonetic/phonological diagrams.
Originally made for CSC309 (Programming on the Web) Winter 2022 at the University of Toronto.

The demo page can be found at `index.html`, or hosted [here](https://robinhuo.github.io/Phonolo.js/).
It uses [Prism.js](https://prismjs.com/).
## Getting Started
To use Phonolo.js, include `phonolo.js` and `phonolo.css` in your HTML file:
```
<link rel="stylesheet" href="path/to/phonolo.css">
<script src="path/to/phonolo.js"></script>
```
The API classes will be exposed via the global `Phonolo` object:
```
const {
    Inventory,
    Segment,
    Word,
    FeatureBundle,
    Rule,
    ConsonantTable,
    VowelChart
} = Phonolo;
```

Most of the features in Phonolo.js require you to specify a phonological feature system.
A feature system based on that of the UCLA phonologist
[Bruce Hayes](https://linguistics.ucla.edu/people/hayes/120a/Index.htm#features)
is provided here as `hayes.js`.
To use it, include `hayes.js` in your HTML: `<script src="path/to/hayes.js"></script>`.
Then you can instantiate the feature system using:
```
const featureSystem = Phonolo.Inventory.fromObject(hayes);
```

You can then instantiate smaller segment inventories based on this feature system
by specifying which segments to include:
```
// The phonemes of English
const english = Inventory.fromFeatureSystem(featureSystem, [
    "p", "t", "k", "b", "d", "ɡ", "t͡ʃ", "d͡ʒ", "f", "θ", "s", "ʃ", "h", "v",
    "ð", "z", "ʒ", "m", "n", "ŋ", "ɹ", "j", "l", "w", "i", "u", "ɪ", "ʊ", "e",
    "o", "ɛ",  "ə", "ʌ", "ɔ", "æ", "ɑ", "a", "ɾ"
]);
```

Now you can easily create diagrams and add them to your document:
```
// Make consonant table for the consonants of English
const consonants = new Phonolo.ConsonantTable(english.getSegments(), english);
document.body.appendChild(consonants.createElement());

// Vowel chart for the vowels of English
const vowels = new Phonolo.VowelChart(english.getSegments(), english);
document.body.appendChild(vowels.createElement());
```

