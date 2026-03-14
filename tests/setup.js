/**
 * Jest setup: minimal DOM for state.js (savePanels needs #route-section, #panel)
 * and load app scripts in dependency order so window.Aalto and window.AaltoUtils exist.
 */
const path = require('path');

document.body.innerHTML = '<div id="route-section"></div><div id="panel"></div>';

require(path.join(__dirname, '..', 'js', 'state.js'));
require(path.join(__dirname, '..', 'js', 'i18n.js'));
require(path.join(__dirname, '..', 'js', 'utils.js'));
