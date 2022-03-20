function Phonolo() {
    "use strict";

    class Inventory {

        phonemes = {};
        featureToPhoneme = {};

        constructor(phonemes) {
            for (const phon of phonemes) {
                this.addPhoneme(phon);
            }
        }

        addPhoneme(phoneme) {
            this.phonemes[phoneme.symbol] = phoneme;
            for (const feat in phoneme.features) {
                if (!(feat in this.featureToPhoneme))
                    this.featureToPhoneme[feat] = {};
                if (!(phoneme.features[feat] in this.featureToPhoneme[feat]))
                    this.featureToPhoneme[feat][phoneme.features[feat]] = [];
                this.featureToPhoneme[feat][phoneme.features[feat]].push(phoneme);
            }
        }

        parse(text) {
            // https://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
            const escape = /[-\/\\^$*+?.()|[\]{}]/g;
            const phonemeRegex = new RegExp(
                Object.keys(this.phonemes)
                    .sort()
                    .reverse()
                    .map(s => s.replace(escape, '\\$&'))
                    .join("|")
                , "uy"
            );

            const segments = [];
            let result;
            while (phonemeRegex.lastIndex < text.length) {
                result = phonemeRegex.exec(text);
                if (result) {
                    segments.push(this.phonemes[result[0]]);
                } else {
                    throw new Error("Failed to parse string");
                }
            }
            return segments;
        }

    }


    class Phone {

        symbol;
        name;
        features = {};

        constructor(symbol, name, features) {
            this.symbol = symbol;
            this.name = name;
            if (features) this.features = features;
        }

        createElement(withPopup = false) {
            const elem = document.createElement("span");
            elem.classList.add("phonolo", "phonolo-phone");
            elem.innerText = this.symbol;

            if (withPopup) {
                elem.classList.add("phonolo-interact");
                const popup = this.createPopup();
                elem.addEventListener("click", () => {
                    document.querySelector("#phonolo-popup")?.remove();
                    document.body.appendChild(popup);
                });
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
                        ${this.name}
                    </div>
                    <div class="phonolo-allophones">
                    </div>
                </div>
            `;

            popup.appendChild(new FeatureBundle(this.features).createElement());

            return popup;
        }

    }


    class Phoneme extends Phone {

        allophones = [];

        constructor(symbol, name, features, allophones = []) {
            super(symbol, name, features);
            for (const phon of allophones) {
                this.allophones.push(phon);
            }
        }

        createPopup() {
            const popup = super.createPopup();

            const allophoneList = popup.querySelector(".phonolo-allophones");
            allophoneList.innerText = `[${this.allophones.join(", ")}]`;

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

        createElement(brackets = true) {
            const elem = document.createElement("div");
            elem.classList.add("phonolo", "phonolo-featurebundle");

            const list = document.createElement("div");
            list.classList.add("phonolo-features");
            for (const [feat, val] of Object.entries(this.features)) {
                const valDiv = document.createElement("div");
                valDiv.classList.add("phonolo-feature-value");
                valDiv.innerText = val;
                list.appendChild(valDiv);

                const featDiv = document.createElement("div");
                featDiv.classList.add("phonolo-feature-feature");
                featDiv.innerText = feat;
                list.appendChild(featDiv);

            }
            elem.appendChild(list);

            if (brackets) {
                const left = document.createElement("div");
                left.classList.add("phonolo-bracket-left");
                
                const right = document.createElement("div");
                right.classList.add("phonolo-bracket-right");

                list.before(left);
                list.after(right);
            }

            return elem;
        }

    }


    return {
        Inventory,
        Phone,
        Phoneme,
        Word
    };
}
