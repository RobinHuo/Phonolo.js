(function () {
    "use strict";

    /**
     * Add an event listener to element that will create a popup.
     * The event type is given by event.
     * The popup element should be created and returned by getPopup.
     * 
     * @param {HTMLElement} element 
     * @param {string} event 
     * @param {function} getPopup 
     */
    function addPopup(element, event, getPopup) {
        element.addEventListener(event, e => {
            const popup = getPopup();
            popup.classList.add("phonolo-popup");

            popup.style.top = "5px";
            popup.style.right = "5px";

            clearPopups();
            document.body.appendChild(popup);

            document.body.addEventListener("click", clearPopups, {capture: true});
        });
    }

    /**
     * Clear all popups in the document.
     * 
     * @param {Event} [e]
     */
    function clearPopups(e) {
        if (!e || !e.target.matches(".phonolo-popup, .phonolo-popup *"))
            document.querySelectorAll(".phonolo-popup").forEach(popup => { popup.remove(); });
    }


    /**
     * A class representing a feature system or a segment inventory.
     */
    class Inventory {

        /**
         * A dictionary of the segments in the inventory.
         * Maps segment symbol to Segment objects.
         * 
         * @type {Object.<string, Segment>}
         */
        segments = {};

        /**
         * A dictionary mapping features to feature values and segments.
         * Keys are feature names.
         * Values are objects whose keys are feature values
         * and values are arrays containing the Segment objects
         * in this.segments that have the corresponding value
         * for the corresponding feature.
         * 
         * @type {Object.<string, Object.<string, Array.<Segment>>>}
         */
        features = {};

        /**
         * A reference to another Inventory instance that models
         * the feature system used by this inventory.
         * That is, the segments and features in this inventory
         * should be a subset of those in featureSystem.
         * Optional.
         * 
         * @type {?Inventory}
         */
        featureSystem;

        /**
         * Return an Inventory object parsed from obj.
         * obj should be an object whose keys are Segment symbols
         * and values are feature specifications
         * (objects whose keys are features names and values are feature values).
         * If json is true then obj is assumed to be a JSON string.
         * 
         * @param {(Object.<string, Object.<string, string>>|string)} obj 
         * @param {boolean} json 
         * @returns {Inventory}
         */
        static fromObject(obj, json = false) {
            if (json) obj = JSON.parse(obj);
            const segments = [];
            for (const symbol in obj.features) {
                segments.push(new Segment(symbol, obj.features[symbol]));
            }
            const { features, ...rest } = obj;
            const inventory = new Inventory(segments);
            inventory.featureSystem = inventory;
            return Object.assign(inventory, rest);
        }

        /**
         * Return an Inventory object based off featureSystem that contains
         * all the given segments, which is taken in as an array of segment symbols.
         * If distinctive is true, only the distinctive features in segments are kept.
         * 
         * @param {Inventory} featureSystem
         * @param {string} segments
         * @param {boolean} distinctive
         * @returns {Inventory}
         */
        static fromFeatureSystem(featureSystem, segments, distinctive = true) {
            // Find distinctive features
            const map = new Map();
            if (distinctive) {
                for (const segment of segments) {
                    for (const [feat, val] of
                            Object.entries(featureSystem.segments[segment].features)) {
                        if (!map.has(feat)) map.set(feat, new Set());
                        map.get(feat).add(val);
                    }
                }
            }

            const phonemes = [];
            for (const segment of segments) {
                const features = {};
                for (const [feat, val] of
                        Object.entries(featureSystem.segments[segment].features)) {
                    if (!distinctive || map.get(feat).size > 1) features[feat] = val;
                }
                phonemes.push(new Segment(segment, features));
            }
            return new Inventory(phonemes, featureSystem);
        }

        /**
         * Create a new Inventory with the given segments
         * and optionally based off the given feature system.
         * 
         * @param {Array.<Segment>} segments
         * @param {Inventory} [featureSystem]
         */
        constructor(segments, featureSystem) {
            for (const segment of segments) {
                this.addSegment(segment);
            }
            if (featureSystem) this.featureSystem = featureSystem;
        }

        addSegment(segment) {
            this.segments[segment.symbol] = segment;
            for (const feat in segment.features) {
                if (!(feat in this.features))
                    this.features[feat] = {};
                if (!(segment.features[feat] in this.features[feat]))
                    this.features[feat][segment.features[feat]] = [];
                this.features[feat][segment.features[feat]].push(segment);
            }
        }

        getSegments(features) {
            return Object.entries(features ?? {}).reduce(
                (prev, [feat, val]) => prev.filter(x => new Set(this.features[feat][val]).has(x)),
                Object.values(this.segments)
            );
        }

        /**
         * Return the list of possible values for a feature.
         * 
         * @param {string} feature 
         * @returns {Array.<string>}
         */
        getValues(feature) {
            return Object.keys(this.features[feature]);
        }

        /**
         * Parse the given string as a transcription using the segments in this inventory
         * and return an array of these segments.
         * 
         * @throws Throws an error if the text cannot be fully parsed.
         * @param {string} text
         * @returns {Array.<Segment>}
         */
        parse(text) {
            // Replacement pattern to escape all special regex symbols
            // https://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
            const escape = /[-\/\\^$*+?.()|[\]{}]/g;

            // Union of all the symbols in this.segments
            const segmentRegex = new RegExp(`(${
                Object.keys(this.segments)
                    .sort()
                    .reverse()
                    .map(s => s.normalize().replace(escape, "\\$&"))
                    .join("|")
                })(\\s*)`, "uy"
            );

            const segments = [];
            let result;
            while (segmentRegex.lastIndex < text.length) {
                result = segmentRegex.exec(text);
                if (result) {
                    segments.push(this.segments[result[1]]);
                } else {
                    throw new Error("Failed to parse string");
                }
            }
            return segments;
        }

    }


    /**
     * A class representing a segment.
     */
    class Segment {

        // Constants for use in rules
        static NULL = new Segment("∅");
        static C = new Segment("C");
        static V = new Segment("V");
        static WORD_BOUNDARY = new Segment("#");

        /**
         * The symbol used to transcribe this segment.
         * 
         * @type {string}
         */
        symbol;

        /**
         * The feature specification for this segment.
         * Keys are feature names and values are feature values.
         * 
         * @type {Object.<string, string>}
         */
        features = {};

        /**
         * The name of this segment.
         * Optional.
         * 
         * @type {?string}
         */
        name;

        /**
         * Create a new Segment with the given symbol, features, and name.
         * 
         * @param {string} symbol
         * @param {Object.<string, string>} features
         * @param {string} [name]
         */
        constructor(symbol, features, name) {
            this.symbol = symbol.normalize();
            if (features) this.features = features;
            if (name) this.name = name;
        }

        /**
         * Create and return a DOM element representing this segment.
         * If an inventory is provided,
         * the created DOM element will be interactive.
         * 
         * @param {Inventory} [inventory]
         * @returns {HTMLElement}
         */
        createElement(inventory, svg = false) {
            const elem = svg ?
                document.createElementNS("http://www.w3.org/2000/svg", "tspan") :
                document.createElement("span");
            elem.classList.add("phonolo", "phonolo-segment");
            elem.append(document.createTextNode(this.symbol));

            if (inventory && this.features && Object.keys(this.features).length) {
                elem.classList.add("phonolo-interact");
                addPopup(elem, "click", () => this.createPopup(inventory));
            }

            return elem;
        }

        createPopup(inventory) {
            const popup = document.createElement("div");
            popup.id = "phonolo-popup";
            popup.classList.add("phonolo", "phonolo-popup");

            popup.innerHTML = `
                <div class="phonolo-phonegrid">
                    <div class="phonolo-symbol">
                        ${this.symbol}
                    </div>
                    <div class="phonolo-name">
                        ${this.name ?? ""}
                    </div>
                    <div class="phonolo-allophones">
                    </div>
                </div>
            `;

            if (this.features && Object.keys(this.features).length)
                popup.appendChild(new FeatureBundle(this.features).createElement(inventory));

            return popup;
        }

    }


    /**
     * A class representing a word with a phonetic/phonemic transcription.
     */
    class Word {

        /**
         * The original text of the word.
         * 
         * @type {string}
         */
        text;

        /**
         * Transcription of the word.
         * 
         * @type {Array.<(Segment|string)>}
         */
        transcription;

        /**
         * The inventory that the segments in the transcription belong to.
         * Optional.
         * 
         * @type {?Inventory}
         */
        inventory;

        /**
         * The DOM element for this Word.
         * 
         * @type {HTMLElement}
         */
        element;

        /**
         * Create a new Word with the given text and transcription.
         * 
         * @param {string} text
         * @param {Array.<(Segment|string)>} transcription
         * @param {Inventory} [inventory]
         */
        constructor(text, transcription, inventory) {
            this.text = text;
            this.transcription = transcription;
            if (inventory) this.inventory = inventory;
        }

        createElement() {
            this.element = document.createElement("span");
            this.element.classList.add("phonolo", "phonolo-word");

            this.element.addEventListener("mouseenter", e => this.showTranscription());
            this.element.addEventListener("mouseleave", e => this.showText());

            this.showText();
        }

        /**
         * Get the DOM element for this Word.
         * 
         * @returns {HTMLElement} the DOM element for this Word
         */
        getElement() {
            if (!this.element) {
                this.createElement();
            }
            return this.element;
        }

        showText() {
            this.element.innerText = this.text;
        }

        showTranscription() {
            this.element.replaceChildren(...this.transcription.map(phon => {
                if (typeof phon === "string") return phon;
                return phon.createElement(this.inventory);
            }));
        }

    }


    /**
     * A class representing a feature bundle.
     */
    class FeatureBundle {

        /**
         * Feature specification for this feature bundle.
         * 
         * @type {Object.<string, string>}
         */
        features;

        /**
         * Whether this feature bundle is editable.
         * 
         * @type {boolean}
         */
        editable;

        /**
         * Stores the HTMLElement for this feature bundle if editable.
         * 
         * @type {?HTMLElement}
         */
        element;

        /**
         * Create a new FeatureBundle with the given features.
         * If editable is true then the feature bundle element will be editable.
         * 
         * @param {Object.<string, string>} features 
         * @param {boolean} [editable=false]
         */
        constructor(features, editable = false) {
            this.features = features;
            this.editable = editable;
        }

        /**
         * Create and return a DOM element representing this feature bundle.
         * If an inventory is given, the created element
         * will be interactive.
         * If brackets is true (default), the bundle will be drawn with brackets.
         * 
         * @param {Inventory} [inventory]
         * @param {boolean} [brackets=true]
         * @returns 
         */
        createElement(inventory, brackets = true) {
            if (this.element) return this.element;
            
            const elem = document.createElement("div");
            elem.classList.add("phonolo", "phonolo-featurebundle");
            if (this.editable) {
                this.element = elem;
                elem.classList.add("phonolo-droppable");
            }

            const createFeature = feature => {
                const tr = document.createElement("tr");
                tr.classList.add("phonolo-feature");

                const valEntry = document.createElement("td");
                valEntry.classList.add("phonolo-feature-value");
                valEntry.innerText = this.features[feature];
                tr.appendChild(valEntry);
                
                const featEntry = document.createElement("td");
                featEntry.classList.add("phonolo-feature-feature");
                featEntry.innerText = feature;
                tr.appendChild(featEntry);
                
                // Toggle feature value on click if editable
                if (inventory && this.editable) {
                    valEntry.classList.add("phonolo-edit");
                    valEntry.addEventListener("click", e => {
                        const vals = inventory.getValues(feature);
                        let idx = vals.findIndex(x => x === this.features[feature]);
                        if (idx === -1) throw new Error("Invalid feature value");
                        idx = (idx + 1) % vals.length;
                        valEntry.innerText = vals[idx];
                        this.features[feature] = vals[idx];
                    });
                }

                // Add popup on click
                if (inventory) {
                    tr.classList.add("phonolo-interact");
                    addPopup(tr, "click", () => this.createPopup({[feature]: this.features[feature]}, inventory));
                }

                // Drag and drop features
                tr.addEventListener("mousedown", e => {
                    // Check if left mouse button
                    if (e.button !== 0) return;

                    const shiftX = e.clientX - tr.getBoundingClientRect().left;
                    const shiftY = e.clientY - tr.getBoundingClientRect().top;

                    const dragging = this.editable ? tr : tr.cloneNode(true);

                    let currTarget = null;                    
                    const onmousemove = e => {
                        e.preventDefault();

                        if (!dragging.classList.contains("phonolo-drag")) {
                            dragging.classList.add("phonolo-drag");
                            if (!this.editable) tr.after(dragging);
                        }

                        dragging.style.left = `${e.clientX - shiftX}px`;
                        dragging.style.top = `${e.clientY - shiftY}px`;

                        const below = document.elementsFromPoint(e.clientX, e.clientY);
                        if (!below.length) return;
                        
                        const newTarget = below.find(el => el.matches(".phonolo-featurebundle.phonolo-droppable"));
                        if (currTarget !== newTarget) {
                            currTarget?.classList.remove("phonolo-hovering");
                            currTarget = newTarget;
                            currTarget?.classList.add("phonolo-hovering");
                        }
                    };
                    document.addEventListener("mousemove", onmousemove);

                    document.addEventListener("mouseup", e => {
                        document.removeEventListener("mousemove", onmousemove);
                        if (dragging.classList.contains("phonolo-drag")) {
                            dragging.classList.remove("phonolo-drag");
                            currTarget?.classList.remove("phonolo-hovering");
                            if (currTarget === elem) return;
                            if (currTarget) {
                                const event = new CustomEvent("phonolo-featuredrop", { detail: {
                                    feature: feature,
                                    value: this.features[feature]
                                } });
                                currTarget.dispatchEvent(event);
                            }
                            dragging.remove();
                            if (this.editable) {
                                delete this.features[feature];
                            }
                        }
                    }, { once: true });
                });

                return tr;
            };

            const list = document.createElement("table");
            list.classList.add("phonolo-features");
            for (const feature in this.features) {
                list.appendChild(createFeature(feature));
            }
            elem.appendChild(list);

            if (brackets) {
                const left = document.createElement("div");
                left.classList.add("phonolo-bracket-left");
                
                const right = document.createElement("div");
                right.classList.add("phonolo-bracket-right");

                list.before(left);
                list.after(right);

                if (inventory) {
                    for (const bracket of [left, right]) {
                        bracket.classList.add("phonolo-interact");
                        addPopup(bracket, "click", () => this.createPopup(this.features, inventory));
                        bracket.addEventListener("mouseenter", e => {
                            left.classList.add("phonolo-active");
                            right.classList.add("phonolo-active");
                        });
                        bracket.addEventListener("mouseleave", e => {
                            left.classList.remove("phonolo-active");
                            right.classList.remove("phonolo-active");
                        });
                    }
                }
            }

            // Handle feature dropping
            if (this.editable) {
                elem.addEventListener("phonolo-featuredrop", ({ detail : { feature, value } }) => {
                    this.features[feature] = value;
                    for (const tr of list.children) {
                        if (tr.lastElementChild.innerText === feature) {
                            tr.firstElementChild.innerText = value;
                            return;
                        }
                    }
                    list.appendChild(createFeature(feature));
                });
            }

            return elem;
        }

        createPopup(features, inventory) {
            const popup = document.createElement("div");
            popup.classList.add("phonolo", "phonolo-popup", "phonolo-naturalclass");

            const entries = Object.entries(features);
            let innerText;
            if (entries.length === 1) {
                innerText = `${entries[0][1]}${entries[0][0]}`;
            } else {
                innerText = "these features";
            }

            const segments = inventory.getSegments(features);

            if (segments.length) {
                popup.innerHTML =
                    `<div class="phonolo-naturalclass-header">
                        Segments with ${innerText}:
                    </div>`;

                const list = document.createElement("div");
                list.classList.add("phonolo-naturalclass-segments");
                for (const segment of segments) {
                    list.appendChild(segment.createElement(inventory));
                    list.append(", ");
                }
                list.lastChild.remove();
                popup.appendChild(list);
            } else {
                popup.innerHTML = 
                    `<div class="phonolo-naturalclass-header">
                        No segments with ${innerText}.
                    </div>`;
            }

            return popup;
        }

    }


    /**
     * A class representing a linear phonological rule.
     */
    class Rule {

        /**
         * The target of the rule.
         * 
         * @type {(Segment|FeatureBundle)}
         */
        target;

        /**
         * The result of the rule.
         * 
         * @type {(Segment|FeatureBundle)}
         */
        result;

        /**
         * The left environment of the rule.
         * 
         * @type {Array.<(Segment|FeatureBundle)>}
         */
        environmentLeft;

        /**
         * The right environment of the rule.
         * 
         * @type {Array.<(Segment|FeatureBundle)>}
         */
        environmentRight;

        /**
         * Create a new Rule with the given parameters.
         * 
         * @param {(Array.<(Segment|FeatureBundle)>|(Segment|FeatureBundle))} target
         * @param {(Array.<(Segment|FeatureBundle)>|(Segment|FeatureBundle))} result
         * @param {Array.<(Segment|FeatureBundle)>} [environmentLeft]
         * @param {Array.<(Segment|FeatureBundle)>} [environmentRight]
         */
        constructor(target, result, environmentLeft = [], environmentRight = []) {
            this.target = Array.isArray(target) ? target : [target];
            this.result = Array.isArray(result) ? result : [result];
            this.environmentLeft = environmentLeft;
            this.environmentRight = environmentRight;
        }

        /**
         * Create and return a new DOM element representing this rule.
         * If inventory is given, the created element will be interactive.
         * 
         * @param {Inventory} [inventory]
         * @returns 
         */
        createElement(inventory) {
            const elem = document.createElement("div");
            elem.classList.add("phonolo", "phonolo-rule");
            
            this.target.forEach(item => {
                elem.appendChild(item.createElement(inventory));
            });

            const arrow = document.createElement("div");
            arrow.classList.add("phonolo-rule-arrow");
            arrow.innerText = "→";
            elem.appendChild(arrow);

            this.result.forEach(item => {
                elem.appendChild(item.createElement(inventory));
            });

            if (this.environmentLeft?.length || this.environmentRight?.length) {
                const slash = document.createElement("div");
                slash.classList.add("phonolo-rule-slash");
                slash.innerText = "/";
                elem.appendChild(slash);

                this.environmentLeft?.forEach(item => {
                    elem.appendChild(item.createElement(inventory));
                });

                const underscore = document.createElement("div");
                underscore.classList.add("phonolo-rule-underscore");
                elem.appendChild(underscore);

                this.environmentRight?.forEach(item => {
                    elem.appendChild(item.createElement(inventory));
                });
            }
            
            return elem;
        }

    }


    /**
     * A class representing a consonant table.
     */
    class ConsonantTable {
        
        /**
         * The segments in the table.
         * 
         * @type {Array.<Segment>}
         */
        segments;

        inventory;

        constructor(segments, inventory) {
            this.segments = segments;
            if (inventory) this.inventory = inventory;
        }

        createElement(inventory) {
            inventory = inventory ?? this.inventory;

            const consonants = this.segments.map(segment => {
                const classification = inventory.featureSystem.classifyConsonant(segment);
                if (classification) classification.segment = segment;
                return classification;
            }).filter(x => x);

            const placeSet = new Set(consonants.map(cons => cons.place));
            const places = inventory.featureSystem?.places ?
                inventory.featureSystem.places.filter(place => placeSet.has(place)) :
                Array.from(placeSet);

            const mannerSet = new Set(consonants.map(cons => cons.manner));
            const manners = inventory.featureSystem?.manners ?
                inventory.featureSystem.manners.filter(manner => mannerSet.has(manner)) :
                Array.from(mannerSet);
            
            const voicings = Array.from(new Set(consonants.map(cons => cons.voicing))).sort();
            
            const table = document.createElement("table");
            table.classList.add("phonolo");
            table.classList.add("phonolo-consonants");
            
            const placeHeader = document.createElement("tr");
            placeHeader.appendChild(document.createElement("th"));
            places.forEach(place => {
                const elem = document.createElement("th");
                elem.classList.add("phonolo-consonants-place");
                elem.scope = "col";
                elem.innerText = place[0].toUpperCase() + place.slice(1);
                placeHeader.appendChild(elem);
            });
            table.appendChild(placeHeader);

            manners.forEach(manner => {
                const row = document.createElement("tr");
                const mannerElem = document.createElement("th");
                mannerElem.classList.add("phonolo-consonants-manner");
                mannerElem.scope = "row";
                mannerElem.innerText = manner[0].toUpperCase() + manner.slice(1);
                row.appendChild(mannerElem);

                const elems = new Array(places.length);
                const placeToCons = consonants.filter(cons => cons.manner === manner).reduce((prev, curr) => {
                    if (!(curr.place in prev)) prev[curr.place] = [];
                    prev[curr.place].push(curr);
                    return prev;
                }, {});
                for (const place in placeToCons) {
                    const td = document.createElement("td");
                    const div = document.createElement("div");
                    div.classList.add("phonolo-consonants-consonant");
                    td.appendChild(div);

                    let i = 0;
                    placeToCons[place].sort((a, b) => a.voicing - b.voicing).forEach(cons => {
                        // while (i < voicings.length && voicings[i] !== cons.voicing) {
                        //     div.appendChild(document.createElement("span"));
                        //     i++;
                        // }
                        div.appendChild(cons.segment.createElement(inventory));
                        i++;
                    });
                    // while (i < voicings.length) {
                    //     div.appendChild(document.createElement("span"));
                    //     i++;
                    // }

                    elems[places.findIndex(p => p === place)] = td;
                }
                for (const elem of elems) {
                    row.appendChild(elem ?? document.createElement("td"));
                }

                table.appendChild(row);
            });

            return table;
        }
    }

    class VowelChart {

        static _id = 0;

        segments;

        inventory;

        constructor(segments, inventory) {
            this.segments = segments;
            if (inventory) this.inventory = inventory;
        }

        createElement(inventory) {
            inventory = inventory ?? this.inventory;

            const RATIO = 0.55;
            const HEIGHT = 80;
            const id = VowelChart._id++;

            const div = document.createElement("div");
            div.classList.add("phonolo");
            div.classList.add("phonolo-vowels");
            div.innerHTML =
                `<svg viewBox="-10 -10 120 ${HEIGHT + 20}" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <mask id="mask-${id}">
                            <rect x="-10" y="-10" width="100%" height="100%" fill="white" />
                        </mask>
                    </defs>
                    <g class="phonolo-vowels-trapezoid" mask="url(#mask-${id})" stroke="black" stroke-width="0.5">
                        <line x1="100" y1="0" x2="0" y2="0" />
                        <line x1="100" y1="${HEIGHT/3}" x2="${100*(1-RATIO)/3}" y2="${HEIGHT/3}" />
                        <line x1="100" y1="${HEIGHT*2/3}" x2="${200*(1-RATIO)/3}" y2="${HEIGHT*2/3}" />
                        <line x1="100" y1="${HEIGHT}" x2="${100*(1-RATIO)}" y2="${HEIGHT}" />
                        <line x1="100" y1="0" x2="100" y2="${HEIGHT}" />
                        <line x1="50" y1="0" x2="${100-100*RATIO/2}" y2="${HEIGHT}" />
                        <line x1="0" y1="0" x2="${100-100*RATIO}" y2="${HEIGHT}" />
                    </g>
                </svg>`;
            
            const svg = div.querySelector("svg");
            const mask = svg.querySelector("mask");
            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");

            const vowels = this.segments.map(segment => {
                const classification = inventory.featureSystem.classifyVowel(segment);
                if (classification) classification.segment = segment;
                return classification;
            }).filter(x => x);
            
            const circs = new Set();
            vowels.forEach(vowel => {
                let x = (100 - vowel.backness * 50 * (RATIO + (1-RATIO) * (3-vowel.height)/3));
                let y = vowel.height * HEIGHT/3;
                if (!circs.has(`${vowel.backness},${vowel.height}`)) {
                    circs.add(`${vowel.backness},${vowel.height}`);

                    const circ = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                    circ.setAttributeNS(null, "cx", x);
                    circ.setAttributeNS(null, "cy", y);
                    circ.setAttributeNS(null, "r", 2);
                    g.appendChild(circ);
                }

                x += (vowel.rounding ? 1 : -1) * 7;
                const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                const tspan = vowel.segment.createElement(inventory, true);
                text.append(tspan);
                text.setAttributeNS(null, "x", x);
                text.setAttributeNS(null, "y", y);
                text.setAttributeNS(null, "dominant-baseline", "middle");
                text.setAttributeNS(null, "text-anchor", "middle");
                g.appendChild(text);

                const clip = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                clip.setAttributeNS(null, "fill", "black");
                clip.setAttributeNS(null, "cx", x);
                clip.setAttributeNS(null, "cy", y);
                clip.setAttributeNS(null, "r", 5);
                mask.appendChild(clip);
            });

            svg.appendChild(g);

            return div;
        }

    }


    window.Phonolo = {
        Inventory,
        Segment,
        Word,
        FeatureBundle,
        Rule,
        ConsonantTable,
        VowelChart
    };
})();
