function getsvg(event) {
    let t = event.target;
    while(t && t.tagName.toLowerCase()!='svg') {
      t = t.parentElement;
    }
    return t;
}

function getcoords(event) {
    const t = getsvg(event);
    const point = t.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const position = point.matrixTransform(t.getScreenCTM().inverse())                
    return position;
}

var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
        if (mutation.type === 'childList') {
            Array
                .from(mutation.addedNodes)
                .forEach(function (node) {
                    if(node.nodeType != node.ELEMENT_NODE || node.tagName.toLowerCase()!='svg') {
                        return;
                    }
                    node.addEventListener('mousemove', function (event) {
                        const t = getsvg(event);
                        if(!t) {
                            return;
                        }
                        const position = getcoords(event);
                        const svgMoveEvent = new CustomEvent('svgmove', {
                            detail: {x: position.x, y: position.y}
                        });
                        t.dispatchEvent(svgMoveEvent);
                    });
                    function svg_touch_event(name) {
                        node.addEventListener(name, function(event) {
                            const t = getsvg(event);
                            if(!t) {
                                return;
                            }
                            event.preventDefault();
                            event.stopPropagation();
                            const touches = Array.from(event.changedTouches).map(touch => {
                                const position = getcoords(touch);
                                return {identifier: touch.identifier, position: position}
                            });
                            const touchEvent = new CustomEvent('svg'+name, {
                                detail: touches
                            });
                            t.dispatchEvent(touchEvent);
                        });
                    };
                    ['touchstart','touchmove','touchend'].forEach(svg_touch_event)
                });
        }
    });
});

document.addEventListener('mousemove',e => {
    const f = document.activeElement;
    if(f && getsvg(f)) {
        f.blur();
    }
})

function truthy_attribute(value) {
    return value !== null && (value.toLowerCase()=='true' || value=='');
}

class GraphAppElement extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({mode: 'open'});
        this.app_created = new Promise((resolve,reject) => {
            this.resolve_app_created = resolve;
        })
    }
    connectedCallback() {
        if(!this.app) {
            this.try_create();
        }
    }

    try_create() {
        this.shadowRoot.innerHTML = '';

        const base_url = this.getAttribute('baseurl') || window.graph_app_base_url;
        const mode = this.getAttribute('mode') || '';

        if(base_url === undefined) {
            return;
        }

        const link = document.createElement('link');
        link.setAttribute('rel','stylesheet');
        link.setAttribute('href',base_url+'style.css');
        this.shadowRoot.appendChild(link);

        const flags = [base_url, 'blank', mode];
        const div = document.createElement('div');
        this.shadowRoot.appendChild(div);
        observer.observe(div, { childList: true, subtree: true });    
        var app = this.app = Elm.GraphApp.init({ node: div, flags: flags })

        app.ports.reportState.subscribe(data => {
            this.state = data;
            this.dispatchEvent(new CustomEvent('statechanged', { detail: data }));
        });
        this.resolve_app_created(app);
    }

    attributeChangedCallback(name, oldValue, newValue) {
        switch(name) {
            case 'baseurl':
                this.try_create();
                break;
            case 'mode':
                this.change_setting({mode: newValue});
                break;
            case 'changemode':
                this.change_setting({can_change_mode: truthy_attribute(newValue)});
                break;
            case 'disabled':
                this.change_setting({disabled: truthy_attribute(newValue)});
                break;
        }
    }

    async set_scene(scene) {
        await this.app_created;
        this.app.ports.receiveScene.send(scene);
    }

    async change_setting(settings) {
        await this.app_created;
        this.app.ports.settingsPort.send(settings);
    }

    static get observedAttributes() { return ['baseurl', 'mode', 'changemode','disabled']; }
}

customElements.define('graph-app', GraphAppElement);
