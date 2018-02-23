const SimpleVertecApi = require('simple-vertec-api').SimpleVertecApi;
const SimpleVertecQuery = require('simple-vertec-api').SimpleVertecQuery;
const Promise = require('bluebird');
const jsonfile = require('jsonfile');
const os = require("os");
const roamingDir = os.homedir() + '/AppData/Roaming';
const togglVertecAppDataDir = roamingDir + '/TogglVertec';
const vertecProjectsFile = togglVertecAppDataDir + '/vertec-projects.json';
const logger = require('./winston.js');
const execFile = require('child_process').execFile;

class VertecClient {
    constructor(vertecClientParameters) {
        this.simpleVertecApi = new SimpleVertecApi(vertecClientParameters.vertecXmlServerUrl, 
            vertecClientParameters.vertecUsername, 
            vertecClientParameters.vertecPassword,
            true);

        // @ts-ignore
        SimpleVertecQuery.setApi(this.simpleVertecApi);
        this.vertecClientParameters = vertecClientParameters;

        if (vertecClientParameters.vertecXmlServerPath) {
            const fs = require('fs');
            if (!fs.existsSync(vertecClientParameters.vertecXmlServerPath)) {
                console.log(`The vertec xml server executable could not be found under '${vertecClientParameters.vertecXmlServerPath}'.`);
                console.log('Either place the server there or correct the origin in configuration.json in your app data folder.');
                
                process.exit();
            }
    
            this.vertecServer = execFile(vertecClientParameters.vertecXmlServerPath, ['/noservice'], this.handleXmlServerOutput);
        }
    }

    handleXmlServerOutput(error, stdout, stderr) {
        if (error) {
            throw error;
        }

        console.log(stdout);
    }

    getBearbeiter() {
        if (this.bearbeiterPromise) {
            return this.bearbeiterPromise;
        }

        this.bearbeiterPromise = new SimpleVertecQuery()
            .whereOcl('Projektbearbeiter')
            .whereSql(`kuerzel = "${this.vertecClientParameters.vertecUsername}"`)
            .addFields('kuerzel', 'bearbProjekte')
            .get()
            .then(projektBearbeiter => {
                const projektIds = projektBearbeiter.data.Projektbearbeiter.bearbProjekte.objlist.objref;

                return {
                    id: projektBearbeiter.data.Projektbearbeiter.objid,
                    kuerzel: projektBearbeiter.data.Projektbearbeiter.kuerzel,
                    projectIds: projektBearbeiter.data.Projektbearbeiter.bearbProjekte.objlist.objref,                    
                }
            });

        return this.bearbeiterPromise;
    }

    getOwnProjects() {
        if (this.ownProjectsPromise) {
            return this.ownProjectsPromise;
        }

        this.ownProjectsPromise = this.getBearbeiter()
            .then(bearbeiter =>
                new SimpleVertecQuery()
                    .findById(bearbeiter.projectIds)
                    .addFields('code', 'aktiv')
                    .get()
                    .then(projekte => {
                        return projekte.data.Projekt.filter(p => p.aktiv == 1);
                    }));

        return this.ownProjectsPromise;
    }

    getOwnPhasesForProject(projectCode) {
        return new SimpleVertecQuery()
            .whereOcl('Projekt')
            .whereSql(`(code = "${projectCode}") and (Aktiv = 1)`)
            .addFields('allephasen')
            .get()
            .then(projekte => {
                // there may be multiple active projects for one code => this is currently not handled, so it may crash here!
                const allProjectPhaseIds = projekte.data.Projekt.allePhasen.objlist.objref;

                return new SimpleVertecQuery()
                    .findById(allProjectPhaseIds)
                    .addFields('code', 'aktiv', 'beschreibung')
                    .get();
                })
            .then(projectPhases => [].concat(projectPhases.data.ProjektPhase).filter(p => p.aktiv == 1))
            // we need to filter here another time, as we can see other peoples education projects...
            .then(activeProjectPhases => {
                return Promise.filter(activeProjectPhases, activeProjectPhase => {
                    return this.getOwnPhases()
                        .then(ownPhases => {
                            // this is a little bit nasty and may fail if there are multiple phases having the same name.
                            // for some weird reason these phase ids aren't the same and cannot be used.
                            // Hopefully there are no duplicate codes inside one projects phases
                            return ownPhases.some(ownPhase => ownPhase.code == activeProjectPhase.code)
                        });
                    })
                })
    }

    getOwnPhases() {
        if (this.ownPhasesPromise) {
            return this.ownPhasesPromise
        }

        this.ownPhasesPromise = this.getBearbeiter()
            .then(bearbeiter => new SimpleVertecQuery()
                .whereOcl('BearbeiterPhaseLink')
                .whereSql(`(Bearbeiter = ${bearbeiter.id}) and (Aktiv = 1)`)
                .addFields('phase')
                .get())
            .then(bearbeiterPhaseLinks => bearbeiterPhaseLinks.data.BearbeiterPhaseLink.map(bearbeiterPhaseLink => bearbeiterPhaseLink.phase.objref))
            .then(phaseIds => new SimpleVertecQuery()
                .findById(phaseIds)
                .addFields('code', 'aktiv', 'beschreibung')
                .get())
            .then(phases => phases.data.ProjektPhase
                .filter(phase => phase.aktiv == 1)
                .map(phase => ({
                        id: phase.objid,
                        description: phase.beschreibung,
                        code: phase.code
                })));

        return this.ownPhasesPromise;
    }

    getOwnActivities(projectCode) {
        return new SimpleVertecQuery()
            .whereOcl('Projekt')
            .whereSql(`code = "${projectCode}" and (aktiv = 1)`)
            .addFields('taetigkeiten')
            .get()
            .then(projekte => {
                const activityIds = projekte.data.Projekt.taetigkeiten.objlist.objref;

                return new SimpleVertecQuery()
                    .findById(activityIds)
                    .addFields('code', 'aktiv')
                    .get();
            })
            .then(projectActivities => [].concat(projectActivities.data.Taetigkeit).filter(p => p.aktiv == 1));
    }

    getVertecProjectsPhasesAndActivitiesCached() {
        return jsonfile.readFileSync(vertecProjectsFile);
    }

    getVertecProjectsPhasesAndActivities() {
        return Promise.join(this.getVertecProjectsPhasesAndActivitiesFromVertec(), this.getBearbeiter())
            .then(values => {
                const projectsPhasesAndActivities = values[0];
                const bearbeiter = values[1];

                projectsPhasesAndActivities.forEach(p => {
                    p.bearbeiterId = bearbeiter.id,
                    p.bearbeiter = bearbeiter.kuerzel
                });

                jsonfile.writeFileSync(vertecProjectsFile, projectsPhasesAndActivities, {spaces: 2});

                const filtered = projectsPhasesAndActivities
                    .filter(p => !this.vertecClientParameters.excludedProjects.includes(p.projectCode))
                    .filter(p => !this.vertecClientParameters.excludedPhases.includes(p.phaseCode))
                    .filter(p => !this.vertecClientParameters.excludedActivities.includes(p.activityCode));

                return filtered;                
            });
    }

    // todo: this should be improved, we only need to fetch activities once per project
    getVertecProjectsPhasesAndActivitiesFromVertec() {
        return this.getOwnProjects().then(projects => {
            return Promise.all(projects.map(project => this.getOwnPhasesForProject(project.code).then(phases => {
                return Promise.all(phases.map(phase => this.getOwnActivities(project.code).then(activities => {
                    return Promise.all(activities.map(activity => {
                        return {
                            projectId: project.objid,
                            projectCode: project.code,
                            phaseId: phase.objid,
                            phaseCode: phase.code,
                            phaseDescription: phase.beschreibung,
                            activityId: activity.objid,
                            activityCode: activity.code
                        }
                    }))
                })))
            })))
        })
            .then(allProjectsPhasesAndActivities => {
                let merged = [].concat.apply([], allProjectsPhasesAndActivities);
                merged = [].concat.apply([], merged);

                return merged;
            })
            .catch(error => { logger.error(error); return Promise.reject(error); });
    }    
    
    save(vertecTimeEntries) {
        return this.simpleVertecApi.save(vertecTimeEntries);
    }
}

module.exports = {
    VertecClient
}