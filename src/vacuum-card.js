import { LitElement, html } from 'lit-element';
import { hasConfigOrEntityChanged, fireEvent } from 'custom-card-helpers';
import './vacuum-card-editor';
import styles from './styles';
import defaultImage from './vacuum.png';

class VacuumCard extends LitElement {
  static get properties() {
    return {
      hass: Object,
      config: Object,
      mapUrl: String,
      requestInProgress: Boolean,
    };
  }

  static get styles() {
    return styles;
  }

  static async getConfigElement() {
    return document.createElement('vacuum-card-editor');
  }

  static getStubConfig(hass, entities) {
    const [vacuumEntity] = entities.filter(
      (eid) => eid.substr(0, eid.indexOf('.')) === 'vacuum'
    );

    return {
      entity: vacuumEntity || '',
      image: 'default',
    };
  }

  get entity() {
    return this.hass.states[this.config.entity];
  }

  get map() {
    return this.hass.states[this.config.map];
  }

  get image() {
    if (this.config.image === 'default') {
      return defaultImage;
    }

    return this.config.image || defaultImage;
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error('Specifying entity is required!');
    }

    this.config = config;
  }

  getCardSize() {
    return 2;
  }

  shouldUpdate(changedProps) {
    return hasConfigOrEntityChanged(this, changedProps);
  }

  updated(changedProps) {
    if (this.map) {
      const url =
        this.map.attributes.entity_picture + `&t=${new Date().getTime()}`;
      const img = new Image();
      img.onload = () => {
        this.mapUrl = url;
      };
      img.src = url;
    }

    if (
      changedProps.get('hass') &&
      changedProps.get('hass').states[this.config.entity].state !==
        this.hass.states[this.config.entity].state
    ) {
      this.requestInProgress = false;
    }
  }

  handleMore() {
    fireEvent(
      this,
      'hass-more-info',
      {
        entityId: this.entity.entity_id,
      },
      {
        bubbles: true,
        composed: true,
      }
    );
  }

  callService(service, options = {}) {
    this.hass.callService('vacuum', service, {
      entity_id: this.config.entity,
      ...options,
    });
    this.requestInProgress = true;
    this.requestUpdate();
  }

  getAttributes(entity) {
    const {
      status,
      battery_level,
      battery_icon,
    } = entity.attributes;

    return {
      status,
      battery_level,
      battery_icon,
    };
  }

  renderMapOrImage(state) {
    if (this.map) {
      return html` <img class="map" src="${this.mapUrl}" /> `;
    }

    if (this.image) {
      return html` <img class="vacuum ${state}" src="${this.image}" /> `;
    }

    return html``;
  }

  renderToolbar(state) {
    switch (state) {
      case 'cleaning': {
        return html`
          <div class="toolbar">
            <paper-button @click="${() => this.callService('pause')}">
              <ha-icon icon="hass:pause"></ha-icon>
              Pause
            </paper-button>
            <paper-button @click="${() => this.callService('stop')}">
              <ha-icon icon="hass:stop"></ha-icon>
              Stop
            </paper-button>
            <paper-button @click="${() => this.callService('return_to_base')}">
              <ha-icon icon="hass:home-map-marker"></ha-icon>
              Dock
            </paper-button>
          </div>
        `;
      }

      case 'paused': {
        return html`
          <div class="toolbar">
            <paper-button @click="${() => this.callService('start')}">
              <ha-icon icon="hass:play"></ha-icon>
              Continue
            </paper-button>
            <paper-button @click="${() => this.callService('return_to_base')}">
              <ha-icon icon="hass:home-map-marker"></ha-icon>
              Dock
            </paper-button>
          </div>
        `;
      }

      case 'returning': {
        return html`
          <div class="toolbar">
            <paper-button @click="${() => this.callService('start')}">
              <ha-icon icon="hass:play"></ha-icon>
              Continue
            </paper-button>
            <paper-button @click="${() => this.callService('pause')}">
              <ha-icon icon="hass:pause"></ha-icon>
              Pause
            </paper-button>
          </div>
        `;
      }
      case 'docked':
      case 'idle':
      default: {
        const { actions = [] } = this.config;

        const buttons = actions.map(({ name, service, icon }) => {
          const execute = () => {
            const args = service.split('.');
            this.hass.callService(args[0], args[1]);
          };
          return html`<paper-icon-button
            icon="${icon}"
            title="${name}"
            @click="${execute}"
          ></paper-icon-button>`;
        });

        const dockButton = html`
          <paper-icon-button
            icon="hass:home-map-marker"
            title="Dock"
            class="toolbar-icon"
            @click="${() => this.callService('return_to_base')}"
          >
          </paper-icon-button>
        `;

        return html`
          <div class="toolbar">
            <paper-icon-button
              icon="hass:play"
              title="Clean"
              class="toolbar-icon"
              @click="${() => this.callService('start')}"
            >
            </paper-icon-button>

            <paper-icon-button
              icon="mdi:crosshairs-gps"
              title="Locate vacuum"
              class="toolbar-split"
              @click="${() => this.callService('locate')}"
            >
            </paper-icon-button>

            ${state === 'idle' ? dockButton : ''}
            <div class="fill-gap"></div>
            ${buttons}
          </div>
        `;
      }
    }
  }

  render() {
    const { state } = this.entity;
    const { status, battery_level, battery_icon } = this.getAttributes(
      this.entity
    );

    return html`
      <ha-card>
        <div
          class="preview"
          @click="${() => this.handleMore()}"
          ?more-info="true"
        >
          <div class="header">
            <div class="status">
              <span class="status-text" alt=${status}>${status}</span>
              <paper-spinner ?active=${this.requestInProgress}></paper-spinner>
            </div>
            <div class="battery">
              ${battery_level}% <ha-icon icon="${battery_icon}"></ha-icon>
            </div>
          </div>

          ${this.renderMapOrImage(state)}
        </div>

        ${this.renderToolbar(state)}
      </ha-card>
    `;
  }
}

customElements.define('vacuum-card', VacuumCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'vacuum-card',
  name: 'Vacuum Card',
  preview: true,
  description: 'Vacuum card allows you to control your robot vacuum.',
});
