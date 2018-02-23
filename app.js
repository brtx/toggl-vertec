#!/usr/bin/env node

const jsonfile = require('jsonfile');
const os = require("os");
const roamingDir = os.homedir() + '/AppData/Roaming';
const togglVertecAppDataDir = roamingDir + '/TogglVertec';
const configurationFile = togglVertecAppDataDir + '/configuration.json';
let Configuration;

function saveConfiguration() {
    jsonfile.writeFileSync(configurationFile, Configuration, {spaces: 2});    
}

function initConfiguration() {
    const fs = require('fs');

    if (!fs.existsSync(togglVertecAppDataDir)) {
        fs.mkdirSync(togglVertecAppDataDir)
    }

    if (!fs.existsSync(configurationFile)) {
        const templateConfigurationFile = __dirname + '/templateConfiguration.json';

        Configuration = jsonfile.readFileSync(templateConfigurationFile);
        saveConfiguration();

        options.syncprojects = true;
    } else {
        Configuration = jsonfile.readFileSync(configurationFile);
    }
}

const optionDefinitions = [
    { name: 'resetvertecxmlserverlocation', alias: 'r', type: String },
    { name: 'vertecxmlserverurl', alias: 'v', type: String },
    { name: 'vertecxmlserverpath', alias: 'e', type: String },
    { name: 'vertecuser', alias: 'u', type: String },
    { name: 'toggltoken', alias: 't', type: String },
    { name: 'syncprojects', alias: 'p', type: Boolean }
  ];

const commandLineArgs = require('command-line-args');
const options = commandLineArgs(optionDefinitions);

function handleOptions() {    
    if (options.resetvertecxmlserverlocation) {
        Configuration.vertecXmlServerUrl = null;
        Configuration.vertecXmlServerPath = null;
        saveConfiguration();
    } 
    
    if (options.vertecxmlserverurl) {
        Configuration.vertecXmlServerUrl = options.vertecxmlserverurl;
        saveConfiguration();
    } 
    
    if (options.vertecxmlserverpath) {
        Configuration.vertecXmlServerPath = options.vertecxmlserverpath;
        saveConfiguration();        
    }

    if (options.vertecuser) {
        Configuration.vertecUser = options.vertecuser;
        saveConfiguration();
    }

    if (options.toggltoken) {
        Configuration.togglApiToken = options.toggltoken;
        saveConfiguration();
    }
}

const prompt = require('prompt-sync')();

function initVertecXmlServerLocation() {
    if (Configuration.vertecXmlServerUrl) {
        return;
    }

    const defaultLocalVertecXmlServerUrl = 'http://127.0.0.1:8090/xml';
    Configuration.vertecXmlServerUrl = prompt(`vertec xml server url: (default ${defaultLocalVertecXmlServerUrl}) `, { value: defaultLocalVertecXmlServerUrl });

    if (Configuration.vertecXmlServerUrl === defaultLocalVertecXmlServerUrl) {
        const defaultLocalVertecXmlServerPath = 'c:\\Program Files (x86)\\vertec-xml-server\\VertecServer.exe';
        Configuration.vertecXmlServerPath = defaultLocalVertecXmlServerPath;
    }

    saveConfiguration();
}

function initVertecUsername() {
    if (Configuration.vertecUsername) {
        return;
    }
    
    const username = os.userInfo().username;

    Configuration.vertecUsername = prompt(`vertec username: (default ${username}) `, { value: username });
    saveConfiguration();
}

function initTogglApiToken() {
    if (Configuration.togglApiToken) {
        return;
    }

    Configuration.togglApiToken = prompt('toggl api token: ');
    saveConfiguration();
}

function getVertecPasswordFromConfigurationOrPromt() {
    if(Configuration.vertecPassword) {
        return Configuration.vertecPassword;
    } else {
        return prompt('vertec password: ', { echo: '*'});
    }
}

function createTogglVertec() {
    const TogglVertec = require('./toggl-vertec.js').TogglVertec;
    
    const vertecPassword = getVertecPasswordFromConfigurationOrPromt();
    const configuration = Object.assign({}, Configuration, { vertecPassword: vertecPassword });
    
    return new TogglVertec(configuration);
}

function synchronize() {
    const togglVertec = createTogglVertec();

    if (options.syncprojects) {
        return togglVertec.synchronizeVertecProjectsWithToggl();
    } else {
        return togglVertec.synchronizeCurrentTogglTimeEntriesWithVertec();
    }
}

function closeTogglVertec() {
    console.log('We are done here.')

    process.exit();
}

initConfiguration();
handleOptions();
initVertecXmlServerLocation();
initVertecUsername();
initTogglApiToken();

synchronize()
    .then(closeTogglVertec);
