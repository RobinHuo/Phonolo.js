"use strict";

// Import library
const {
    Inventory,
    Segment,
    Word,
    FeatureBundle,
    Rule,
    ConsonantTable,
    VowelChart
} = Phonolo;

// Feature system of Bruce Hayes
// https://linguistics.ucla.edu/people/hayes/120a/Index.htm#features
const features = Inventory.fromObject(hayes);

// Just the phonemes of English
const english = Inventory.fromFeatureSystem(features, [
    "p", "t", "k", "b", "d", "ɡ", "t͡ʃ", "d͡ʒ", "f", "θ", "s", "ʃ", "h", "v",
    "ð", "z", "ʒ", "m", "n", "ŋ", "ɹ", "j", "l", "w", "i", "u", "ɪ", "ʊ", "e",
    "o", "ɛ",  "ə", "ʌ", "ɔ", "æ", "ɑ", "a", "ɾ"
]);

// Some sounds of Japanese
const japanese = Inventory.fromFeatureSystem(features, [
    "a", "i", "u", "e", "o",
    "p", "b", "t", "d", "k", "ɡ", "t͡s", "t͡ɕ", "d͡ʑ", "ɸ", "s", "z", "ɕ", "ʑ",
    "ç", "h", "m", "n", "ɲ", "ɴ", "ɾ", "w", "j"
]);

const transcriptionDiv = document.querySelector("#transcription");
// Sentence as an array of words
const sentence = "the quick brown fox jumps over the lazy dog".split(" ");
// Phonemic transcription of each word
const phonemic = [
    "ðə",
    "kwɪk",
    "bɹaʊn",
    "fɑks",
    "d͡ʒʌmps",
    "ovəɹ",
    "ðə",
    "lezi",
    "dɑɡ"
];
for (let i = 0; i < sentence.length; i++) {
    // Parse the transcription into its segments
    const trans = english.parse(phonemic[i]);
    // Make a Word object with the original word and its parsed transcription
    const word = new Word(sentence[i], trans, english);
    // Display the Word object
    transcriptionDiv.append(word.getElement(), " ");
}

// Consonant table
const consDiv = document.querySelector("#consonants");
// Consonant tables
const tables = [
    // Consonant table with all the consonants of English
    new ConsonantTable(
        english.getSegments(),
        english
    ),
    // Consonant table with the [-continuant] consonants of Japanese
    new ConsonantTable(
        japanese.getSegments({ "continuant": "-" }),
        japanese
    )
];
// Display the tables
tables.forEach(item => {
    consDiv.appendChild(item.createElement());
});

const vowelsDiv = document.querySelector("#vowels");
// Vowel diagrams
const vowels = [
    // Vowel diagram with the vowels of English
    new VowelChart(
        english.getSegments(),
        english
    ),
    // Vowel diagram with the vowels of Japanese
    new VowelChart(
        japanese.getSegments(),
        japanese
    ),
];
// Display the diagrams
vowels.forEach(item => {
    vowelsDiv.appendChild(item.createElement());
});

const featureBundles = document.querySelector("#features");
// Feature bundles
const bundles = [
    new FeatureBundle({
        "syllabic": "+",
        "high": "+",
        "front": "+"
    }),
    new FeatureBundle({
        "syllabic": "-",
        "consonantal": "-",
        "voice": "+"
    }),
    new FeatureBundle({
        "syllabic": "-",
        "consonantal": "+",
        "sonorant": "-",
        "continuant": "+",
        "approximant": "-",
        "voice": "-",
        "spread gl": "-",
        "LABIAL": "-",
        "CORONAL": "+",
        "anterior": "+",
        "distributed": "+",
        "strident": "-",
        "lateral": "-",
        "DORSAL": "-",
    }),
];
bundles.forEach(item => {
    featureBundles.appendChild(item.createElement(english));
});

const rulesDiv = document.querySelector("#rules");
const rules = [

    new Rule(
        new FeatureBundle({
            "syllabic": "-",
            "continuant": "-",
            "voice": "+"
        }),
        new FeatureBundle({
            "voice": "-"
        }),
        [
            new FeatureBundle({
                "syllabic": "-",
                "continuant": "-",
                "voice": "-"
            })
        ],
        [Segment.WORD_BOUNDARY]
    ),

    new Rule(
        Segment.NULL,
        english.segments["p"],
        [
            english.segments["m"]
        ],
        [
            new FeatureBundle({
                "syllabic": "-",
                "continuant": "-",
                "voice": "-",
                "LABIAL": "-"
            })
        ]
    )

];
rules.forEach(item => {
    rulesDiv.appendChild(item.createElement(english));
});

const editDiv = document.querySelector("#editable");
const editable = [

    new FeatureBundle({
        "syllabic": "-",
        "consonantal": "+",
        "sonorant": "-",
        "continuant": "+",
        "approximant": "-",
        "voice": "-",
        "spread gl": "-",
        "LABIAL": "-",
        "CORONAL": "+",
        "anterior": "+",
        "distributed": "+",
        "strident": "-",
        "lateral": "-",
        "DORSAL": "-",
    }, true),

    new FeatureBundle({
        "syllabic": "+",
        "consonantal": "-",
        "DORSAL": "+",
        "high": "-",
        "low": "-",
        "front": "-",
        "back": "-",
        "tense": "-"
    }, true),

    new Rule(
        new FeatureBundle({
            "syllabic": "-",
            "continuant": "-",
            "voice": "+"
        }, true),
        new FeatureBundle({
            "voice": "-"
        }, true),
        [
            new FeatureBundle({
                "syllabic": "-",
                "continuant": "-",
                "voice": "-"
            }, true)
        ],
        [Segment.WORD_BOUNDARY]
    )

];
for (const elem of editable) {
    editDiv.appendChild(elem.createElement(english));
}
