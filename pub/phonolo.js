function Phonolo() {
    "use strict";

    function addPopup(element, event, getPopup) {
        element.addEventListener(event, e => {
            const popup = getPopup();
            popup.classList.add("phonolo-popup");

            popup.style.top = "5px";
            popup.style.right = "5px";

            clearPopups();
            document.body.appendChild(popup);

            document.body.addEventListener("click", clearPopups, {capture: true, once: true});
        });
    }

    function clearPopups(e) {
        if (!e || !e.target.classList.contains("phonolo-popup"))
            document.querySelectorAll(".phonolo-popup").forEach(popup => { popup.remove(); });
    }


    class Inventory {

        segments = {};
        features = {};
        featureSystem;

        static fromObject(obj, json = false) {
            if (json) obj = JSON.parse(obj);
            const segments = [];
            for (const symbol in obj) {
                segments.push(new Phone(symbol, obj[symbol]));
            }
            return new Inventory(segments);
        }

        static fromFeatureSystem(featureSystem, segments) {
            const phonemes = [];
            for (const segment of segments) {
                phonemes.push(new Phone(segment, featureSystem.segments[segment].features));
            }
            return new Inventory(phonemes, featureSystem);
        }

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

        parse(text) {
            // https://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
            const escape = /[-\/\\^$*+?.()|[\]{}]/g;
            const segmentRegex = new RegExp(`(${
                Object.keys(this.phonemes)
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
                    segments.push(this.phonemes[result[1]]);
                } else {
                    throw new Error("Failed to parse string");
                }
            }
            return segments;
        }

    }


    class Phone {

        symbol;
        features = {};
        name;

        constructor(symbol, features, name) {
            this.symbol = symbol.normalize();
            if (features) this.features = features;
            if (name) this.name = name;
        }

        createElement(withPopup = false) {
            const elem = document.createElement("span");
            elem.classList.add("phonolo", "phonolo-phone");
            elem.innerText = this.symbol;

            if (withPopup) {
                elem.classList.add("phonolo-interact");
                addPopup(elem, "click", this.createPopup.bind(this));
            }

            return elem;
        }

        createPopup() {
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

            popup.appendChild(new FeatureBundle(this.features).createElement());

            return popup;
        }

    }


    class Word {

        text;
        phonemes;
        phones;
        dom = {
            element: null,
            state: null
        };

        constructor(text, phonemes, phones) {
            this.text = text;
            this.phonemes = phonemes;
            if (phones) this.phones = phones;
        }

        get element() {
            if (!this.dom.element) {
                this.dom.element = document.createElement("span");
                this.dom.element.classList.add("phonolo", "phonolo-word");

                this.dom.element.addEventListener("mouseenter", this.showPhonemic.bind(this));
                this.dom.element.addEventListener("mouseleave", this.showText.bind(this));

                this.showText();
            }
            return this.dom.element;
        }

        showText() {
            this.dom.element.innerText = this.text;
            this.dom.state = "text";
        }

        showPhonemic() {
            this.dom.element.replaceChildren(...this.phonemes.map(phon => {
                if (typeof phon === "string") return phon;
                return phon.createElement(true);
            }));
            this.dom.state = "phonemic";
        }

        showPhonetic() {
            this.dom.element.replaceChildren(...this.phones.map(phon => {
                if (typeof phon === "string") return phon;
                return phon.createElement(true);
            }));
            this.dom.state = "phonetic";
        }

    }


    class FeatureBundle {

        features;

        constructor(features) {
            this.features = features;
        }

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


    class Rule {

        target;
        result;
        environmentLeft;
        environmentRight;

        constructor(target, result, environmentLeft, environmentRight) {
            this.target = target;
            this.result = result;
            this.environmentLeft = environmentLeft;
            this.environmentRight = environmentRight;
        }

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


    return {
        Inventory,
        Phone,
        Word,
        FeatureBundle,
        Rule
    };
}
