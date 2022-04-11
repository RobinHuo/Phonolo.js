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
            for (const symbol in obj) {
                segments.push(new Segment(symbol, obj[symbol]));
            }
            return new Inventory(segments);
        }

        /**
         * Return an Inventory object based off featureSystem that contains
         * all the given segments, which is taken in as an array of segment symbols.
         * 
         * @param {Inventory} featureSystem
         * @param {string} segments
         * @returns {Inventory}
         */
        static fromFeatureSystem(featureSystem, segments) {
            const phonemes = [];
            for (const segment of segments) {
                phonemes.push(new Segment(segment, featureSystem.segments[segment].features));
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
            return Object.entries(features).reduce(
                (prev, [feat, val]) => prev.filter(x => new Set(this.features[feat][val]).has(x)),
                Object.values(this.segments)
            );
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
         * If withPopup is true and an inventory is provided,
         * the created DOM element will be interactive.
         * 
         * @param {boolean} [withPopup=false]
         * @param {Inventory} [inventory]
         * @returns {HTMLElement}
         */
        createElement(withPopup = false, inventory) {
            const elem = document.createElement("span");
            elem.classList.add("phonolo", "phonolo-phone");
            elem.innerText = this.symbol;

            if (withPopup && this.features && Object.keys(this.features).length) {
                elem.classList.add("phonolo-interact");
                addPopup(elem, "click", this.createPopup.bind(this, inventory));
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
                popup.appendChild(new FeatureBundle(this.features).createElement(true, inventory));

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

            this.element.addEventListener("mouseenter", this.showTranscription.bind(this));
            this.element.addEventListener("mouseleave", this.showText.bind(this));

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
                return phon.createElement(true, this.inventory);
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
         * Create a new FeatureBundle with the given features.
         * 
         * @param {Object.<string, string>} features 
         */
        constructor(features) {
            this.features = features;
        }

        /**
         * Create and return a DOM element representing this feature bundle.
         * If withPopup is true and inventory is given, the created element
         * will be interactive.
         * If brackets is true (default), the bundle will be drawn with brackets.
         * 
         * @param {boolean} [withPopup=false]
         * @param {Inventory} [inventory]
         * @param {boolean} [brackets=true]
         * @returns 
         */
        createElement(withPopup = false, inventory, brackets = true) {
            const elem = document.createElement("div");
            elem.classList.add("phonolo", "phonolo-featurebundle");

            const list = document.createElement("table");
            list.classList.add("phonolo-features");
            for (const [feat, val] of Object.entries(this.features)) {
                const tr = document.createElement("tr");
                tr.classList.add("phonolo-feature");

                const valEntry = document.createElement("td");
                valEntry.classList.add("phonolo-feature-value");
                valEntry.innerText = val;
                tr.appendChild(valEntry);

                const featEntry = document.createElement("td");
                featEntry.classList.add("phonolo-feature-feature");
                featEntry.innerText = feat;
                tr.appendChild(featEntry);

                if (withPopup && inventory) {
                    tr.classList.add("phonolo-interact");
                    addPopup(tr, "click", this.createPopup.bind(this, {[feat]: val}, inventory));
                }

                list.appendChild(tr);
            }
            elem.appendChild(list);

            if (brackets) {
                const left = document.createElement("div");
                left.classList.add("phonolo-bracket-left");
                
                const right = document.createElement("div");
                right.classList.add("phonolo-bracket-right");

                list.before(left);
                list.after(right);

                if (withPopup && inventory) {
                    for (const bracket of [left, right]) {
                        bracket.classList.add("phonolo-interact");
                        addPopup(bracket, "click", this.createPopup.bind(this, this.features, inventory));
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

            popup.innerHTML = `
                <div class="phonolo-naturalclass-header">
                    Segments with ${innerText}:
                </div>
            `

            const list = document.createElement("div");
            list.classList.add("phonolo-naturalclass-segments");
            list.innerText = `${inventory.getSegments(features).map(p => p.symbol).join(", ")}`;
            popup.appendChild(list);

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
         * @param {(Segment|FeatureBundle)} target
         * @param {(Segment|FeatureBundle)} result
         * @param {Array.<(Segment|FeatureBundle)>} environmentLeft
         * @param {Array.<(Segment|FeatureBundle)>} environmentRight
         */
        constructor(target, result, environmentLeft, environmentRight) {
            this.target = target;
            this.result = result;
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
            
            elem.appendChild(this.target.createElement(true, inventory));

            const arrow = document.createElement("div");
            arrow.classList.add("phonolo-rule-arrow");
            arrow.innerText = "→";
            elem.appendChild(arrow);

            elem.appendChild(this.result.createElement(true, inventory));

            const slash = document.createElement("div");
            slash.classList.add("phonolo-rule-slash");
            slash.innerText = "/";
            elem.appendChild(slash);

            this.environmentLeft?.forEach(item => {
                elem.appendChild(item.createElement(true, inventory));
            });

            const underscore = document.createElement("div");
            underscore.classList.add("phonolo-rule-underscore");
            elem.appendChild(underscore);

            this.environmentRight?.forEach(item => {
                elem.appendChild(item.createElement(true, inventory));
            });
            
            return elem;
        }

    }


    window.Phonolo = {
        Inventory,
        Segment,
        Word,
        FeatureBundle,
        Rule
    };
})();
