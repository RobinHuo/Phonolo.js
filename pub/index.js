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

// Just the phonemes of English
const japanese = Inventory.fromFeatureSystem(features, [
    "a", "i", "ɯ", "e", "o",
    "p", "b", "t", "d", "k", "ɡ", "t͡s", "t͡ɕ", "d͡ʑ", "ɸ", "s", "z", "ɕ", "ʑ",
    "ç", "h", "m", "n", "ɲ", "ɴ", "ɾ", "w", "j"
]);

const transcriptionDiv = document.querySelector("#transcription");
const sentence = "the quick brown fox jumps over the lazy dog".split(" ");
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
    const trans = english.parse(phonemic[i]);
    const word = new Word(sentence[i], trans, english);
    transcriptionDiv.append(word.getElement(), " ");
}

// Consonant table
const consDiv = document.querySelector("#consonants");
const tables = [
    new ConsonantTable(
        english.getSegments(),
        english
    ),
    new ConsonantTable(
        japanese.getSegments(),
        japanese
    ),
];
tables.forEach(item => {
    consDiv.appendChild(item.createElement());
});

const vowelsDiv = document.querySelector("#vowels");
const vowels = [
    new VowelChart(
        english.getSegments(),
        english
    ),
    new VowelChart(
        japanese.getSegments(),
        japanese
    ),
];
vowels.forEach(item => {
    vowelsDiv.appendChild(item.createElement());
});
