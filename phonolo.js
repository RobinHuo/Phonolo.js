(function () {
    "use strict";

    /**
     * Add an event listener to the given element that will create a popup
     * when it receives the given event.
     * The popup element should be created and returned by getPopup.
     * 
     * @param {HTMLElement} element - The element that listens for the event.
     * @param {string} event - The type of event to listen for.
     * @param {function} getPopup - A function that returns the popup element.
     * @private
     */
    function addPopup(element, event, getPopup) {
        element.addEventListener(event, e => {
            const popup = getPopup();
            popup.classList.add("phonolo-popup");
            document.body.appendChild(popup);

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
     * @param {Event} [e] - The event causing the clear.
     * @private
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
         * in this Inventory that have the corresponding value
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
         * An Inventory can be its own feature system.
         * 
         * @type {Inventory}
         */
        featureSystem;

        /**
         * Return an Inventory object parsed from obj.
         * obj should have a member object named "features"
         * whose keys are Segment symbols and values are feature specifications
         * (objects whose keys are features names and values are feature values).
         * The returned Inventory object is its own feature system.
         * 
         * @param {(Object|string)} obj - The object to parse from.
         * @param {Object.<string, Object.<string, string>>} obj.features - Segments and their feature specifications.
         * @param {function} [obj.classifyConsonant] - 
         *     Function that takes a Segment and returns a consonant classification:
         *     { place: string, manner: string, voicing: number }.
         *     place is the place of articulation,
         *     manner is the manner of articulation, and
         *     voicing is a number used for ordering consonants within table cells.
         * @param {function} [obj.classifyVowel] - 
         *     Function that takes a Segment and returns a vowel classification:
         *     { height: number, backness: number, rounding: boolean }.
         *     height is a number between 0.0 and 3.0 where 0.0 is high and 3.0 is low,
         *     backness is a number between 0.0 and 2.0 where 0.0 is back and 2.0 is front, and
         *     rounding is a boolean that is true iff the vowel is rounded.
         * @param {Array.<string>} [obj.places] - 
         *     An array of the places of articulation that this feature system classifies, in order.
         * @param {Array.<string>} [obj.manners] - 
         *     An array of the manners of articulation that this feature system classifies, in order.
         * @returns {Inventory} An Inventory object parsed from obj.
         */
        static fromObject(obj) {
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
         * @param {Inventory} featureSystem - The feature system used as a base.
         * @param {string} segments - The symbols of the Segments in featureSystem to use.
         * @param {boolean} [distinctive=true] - True iff only the features that distinguish some pair in segments should be kept.
         * @returns {Inventory} An Inventory object with all the Segments in featureSystem specified by segments.
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

        /**
         * Add a Segment to this Inventory.
         * 
         * @param {Segment} segment - The Segment to add.
         * @private
         */
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

        /**
         * Get the Segments in this Inventory that match a given feature specification.
         * A feature specification is an object mapping features to feature values:
         * { feat1: val1, feat2: val2, ... }.
         * If no feature specification is given, return all Segments in this Inventory.
         * 
         * @param {Object.<string, string>} [features] - A feature specification.
         * @returns {Array.<Segment>} The Segments in this Inventory matching the given features.
         */
        getSegments(features) {
            return Object.entries(features ?? {}).reduce(
                (prev, [feat, val]) => prev.filter(x => new Set(this.features[feat][val]).has(x)),
                Object.values(this.segments)
            );
        }

        /**
         * Return the list of possible values for a feature.
         * 
         * @param {string} feature - The feature to find the possible values for.
         * @returns {Array.<string>} The possible values in this Inventory for feature.
         */
        getValues(feature) {
            return Object.keys(this.features[feature]);
        }

        /**
         * Parse the given string as a transcription using the Segments in this inventory
         * and return an array of these Segments.
         * 
         * @throws Throws an error if the text cannot be fully parsed.
         * @param {string} text - A string comprised of symbols of Segments in this Inventory.
         * @returns {Array.<Segment>} Array of Segments from this Inventory corresponding to text.
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
     * A class representing a phonological segment.
     */
    class Segment {

        /**
         * Null segment for use in rules.
         * 
         * @static
         * @constant
         * @type {Segment}
         */
        static NULL = new Segment("∅");

        /**
         * Generic consonant segment for use in rules.
         * 
         * @static
         * @constant
         * @type {Segment}
         */
        static C = new Segment("C");

        /**
         * Generic vowel segment for use in rules.
         * 
         * @static
         * @constant
         * @type {Segment}
         */
        static V = new Segment("V");

        /**
         * Word boundary segment for use in rules.
         * 
         * @static
         * @constant
         * @type {Segment}
         */
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
         * The features are given as a feature specification:
         * { feat1: val1, feat2: val2, ... }
         * 
         * @param {string} symbol - The symbol used to transcribe this segment.
         * @param {Object.<string, string>} features - The feature specification for this segment.
         * @param {string} [name] - The name of this segment.
         */
        constructor(symbol, features, name) {
            this.symbol = symbol.normalize();
            if (features) this.features = features;
            if (name) this.name = name;
        }

        /**
         * Create and return a DOM element representing this Segment.
         * If an inventory is provided, the created DOM element will be interactive.
         * 
         * @param {Inventory} [inventory] - An Inventory to reference for interactive details.
         * @param {boolean} [svg=false] - True iff the returned element is to be used in an SVG.
         * @returns {HTMLElement} A DOM element representing this Segment.
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

        /**
         * Create and return a popup element for this Segment using info from a given inventory.
         * 
         * @param {Inventory} inventory - The Inventory to use for the popup info.
         * @returns {HTMLElement} The popup element.
         * @private
         */
        createPopup(inventory) {
            const popup = document.createElement("div");
            popup.classList.add("phonolo");

            let name = this.name;
            if (!name) {
                const cons = inventory.featureSystem?.classifyConsonant(this);
                if (cons) {
                    name = `${cons.voicing > 0 ? "voiced" : "voiceless"} ${cons.place} ${cons.manner}`;
                }
            }
            if (!name) {
                const vowel = inventory.featureSystem?.classifyVowel(this);
                if (vowel) {
                    name = 
                        (vowel.rounding ? "rounded" : "unrounded") + " " +
                        (
                            vowel.height < 0.5 ? "high" :
                            vowel.height === 0.5 ? "near-high" :
                            vowel.height <  1.5 ? "close-mid" :
                            vowel.height === 1.5 ? "mid" :
                            vowel.height < 2.5 ? "open-mid" :
                            "low"
                        ) + " " +
                        (
                            vowel.backness < 0.5 ? "back" :
                            vowel.backness === 0.5 ? "near-back" :
                            vowel.backness < 1.5 ? "central" :
                            vowel.backness === 1.5 ? "near-front" :
                            "front"
                        ) + " vowel";
                }
            }

            popup.innerHTML = `
                <div class="phonolo-phonegrid">
                    <div class="phonolo-symbol">
                        ${this.symbol}
                    </div>
                    <div class="phonolo-name">
                        ${name ?? ""}
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
         * Transcription of the word as an array of Segments.
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
         * @private
         */
        element;

        /**
         * Create a new Word with the given text and transcription.
         * 
         * @param {string} text - The original text of the word.
         * @param {Array.<(Segment|string)>} transcription - Transcription of the word as an array of Segments.
         * @param {Inventory} [inventory] - Inventory that the segments come from.
         */
        constructor(text, transcription, inventory) {
            this.text = text;
            this.transcription = transcription;
            if (inventory) this.inventory = inventory;
        }

        /**
         * Create a new DOM element representing this Word.
         * 
         * @returns {HTMLElement} A new DOM element for this Word.
         * @private
         */
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
         * @returns {HTMLElement} The DOM element for this Word.
         */
        getElement() {
            if (!this.element) {
                this.createElement();
            }
            return this.element;
        }

        /**
         * Make this Word's DOM element display the original text.
         * 
         * @private
         */
        showText() {
            this.element.innerText = this.text;
        }

        /**
         * Make this Word's DOM element display the transcription.
         * 
         * @private
         */
        showTranscription() {
            this.element.replaceChildren(...this.transcription.map(segment => {
                if (typeof segment === "string") return segment;
                return segment.createElement(this.inventory);
            }));
        }

    }


    /**
     * A class representing a feature bundle.
     */
    class FeatureBundle {

        /**
         * Feature specification for this feature bundle.
         * A feature specification is an object mapping features to feature values:
         * { feat1: val1, feat2: val2, ... }.
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
         * Stores the DOM element for this feature bundle if editable.
         * 
         * @type {?HTMLElement}
         * @private
         */
        element;

        /**
         * Create a new FeatureBundle with the given features.
         * If editable is true then the feature bundle element will be editable.
         * 
         * @param {Object.<string, string>} features - Feature specification for the bundle.
         * @param {boolean} [editable=false] - True iff the FeatureBundle is to be user-editable.
         */
        constructor(features, editable = false) {
            this.features = features;
            this.editable = editable;
        }

        /**
         * Return a DOM element representing this FeatureBundle.
         * If this FeatureBundle is editable, a new element will only be made
         * if none already exists; otherwise, the cached element is returned.
         * 
         * If an inventory is given, the created element will interactively
         * display info by referencing the given inventory.
         * If this FeatureBundle is editable, the created element can be edited
         * by dragging and dropping features into or out of it,
         * and by clicking feature values to toggle them.
         * If brackets is true (default), the bundle will be drawn with brackets.
         * 
         * @param {Inventory} [inventory] - Inventory to use for interactive info.
         * @param {boolean} [brackets=true] - True iff the element is to be drawn with brackets.
         * @returns {HTMLElement} A DOM element for this FeatureBundle.
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

        /**
         * Create and return a popup element for this FeatureBundle.
         * 
         * @param {Object.<string, string>} features - Feature specification for the popup.
         * @param {Inventory} inventory - Inventory to use for the popup info.
         * @returns {HTMLElement} - A popup element.
         * @private
         */
        createPopup(features, inventory) {
            const popup = document.createElement("div");
            popup.classList.add("phonolo", "phonolo-naturalclass");

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
         * Create a new Rule with the given target, result, and optionally environment.
         * 
         * @param {(Array.<(Segment|FeatureBundle)>|(Segment|FeatureBundle))} target - 
         *     The target of the rule.
         * @param {(Array.<(Segment|FeatureBundle)>|(Segment|FeatureBundle))} result - 
         *     The result of the rule.
         * @param {Array.<(Segment|FeatureBundle)>} [environmentLeft=[]] - 
         *     The left environment for the rule.
         * @param {Array.<(Segment|FeatureBundle)>} [environmentRight=[]] - 
         *     The right environment for the rule.
         */
        constructor(target, result, environmentLeft = [], environmentRight = []) {
            this.target = Array.isArray(target) ? target : [target];
            this.result = Array.isArray(result) ? result : [result];
            this.environmentLeft = environmentLeft;
            this.environmentRight = environmentRight;
        }

        /**
         * Create and return a new DOM element representing this Rule.
         * If inventory is given, the created element will interactively display
         * information from the given inventory.
         * 
         * @param {Inventory} [inventory]
         * @returns {HTMLElement} DOM element for this Rule.
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
         * The Segments in the table.
         * 
         * @type {Array.<Segment>}
         */
        segments;

        /**
         * The Inventory that the Segments in this table come from.
         * Optional.
         * 
         * @type {?Inventory}
         */
        inventory;

        /**
         * Create a new consonant table from the given segments.
         * 
         * @param {Array.<Segment>} segments - The Segments in the table.
         * @param {Inventory} [inventory] - Inventory that the Segments come from.
         */
        constructor(segments, inventory) {
            this.segments = segments;
            if (inventory) this.inventory = inventory;
        }

        /**
         * Create and return a new DOM element for this ConsonantTable.
         * Non-consonant segments in this ConsonantTable are ignored.
         * If no inventory was provided for this ConsonantTable,
         * an inventory must be provided here.
         * 
         * @param {Inventory} [inventory] - Inventory to use for classifying segments.
         * @returns {HTMLElement} A DOM element for this ConsonantTable.
         */
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

    /**
     * A class representing a vowel chart.
     */
    class VowelChart {

        /**
         * Value to ensure unique DOM IDs for created elements.
         * 
         * @static
         * @private
         * @ignore
         */
        static _id = 0;

        /**
         * The Segments in this vowel chart.
         * 
         * @type {Array.<Segment>}
         */
        segments;

        /**
         * The Inventory that the Segments come from.
         * Optional.
         * 
         * @type {?Inventory}
         */
        inventory;

        /**
         * Create a new vowel chart for the given segments.
         * 
         * @param {Array.<Segment>} segments - The Segments in this vowel chart.
         * @param {Inventory} [inventory] - The Inventory that the Segments come from.
         */
        constructor(segments, inventory) {
            this.segments = segments;
            if (inventory) this.inventory = inventory;
        }

        /**
         * Create and return a new DOM element for this VowelChart.
         * Non-vowel segments in this VowelChart are ignored.
         * If no inventory was provided for this VowelChart, an inventory must be provided.
         * 
         * @param {Inventory} [inventory] - Inventory to use for classifying vowels.
         * @returns {HTMLElement} A DOM element for this VowelChart.
         */
        createElement(inventory) {
            inventory = inventory ?? this.inventory;

            const RATIO = 0.55;
            const HEIGHT = 80;
            const id = VowelChart._id++;

            const div = document.createElement("div");
            div.classList.add("phonolo");
            div.classList.add("phonolo-vowels");
            div.innerHTML =
                `<svg viewBox="-15 -15 130 ${HEIGHT + 30}" xmlns="http://www.w3.org/2000/svg">
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

                x += (vowel.rounding ? 1 : -1) * 8;
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
