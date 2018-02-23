const TogglClient = require('toggl-api');
const Promise = require('bluebird');
const VertecClient = require('./vertec.js').VertecClient;
const logger = require('./winston.js');
const _ = require('lodash');
 
class TogglVertec {
    constructor(togglVertecParameters) {
        this.togglVertecParameters = togglVertecParameters;
        this.vertec = new VertecClient(togglVertecParameters)
        this.toggl = Promise.promisifyAll(new TogglClient({ apiToken: togglVertecParameters.togglApiToken }), { context: this.toggl });
    }

    synchronizeVertecProjectsWithToggl() {
        return this.toggl.getWorkspacesAsync()
            .then(togglWorkspaces => this.getTogglAndVertecProjects(togglWorkspaces))
            .then(result => this.synchronizeVertecProjectsWithTogglFor(result));
    }

    getTogglAndVertecProjects(togglWorkspaces) {
        // currently only the the first workspace is supported                
        const workspaceId = togglWorkspaces[0].id;
        
        return Promise.join(this.toggl.getWorkspaceProjectsAsync(workspaceId), this.vertec.getVertecProjectsPhasesAndActivities())
            .then(values => ({
                workspaceId,
                togglProjects: values[0],
                vertecProjects: values[1]
            })) 
    }

    synchronizeVertecProjectsWithTogglFor({workspaceId, togglProjects, vertecProjects}) {
        const togglVertecProjects = togglProjects.filter(matchesVertecProject);

        return Promise.all(vertecProjects.map(vertecProject => this.synchronizeVertecProjectWithTogglFor(workspaceId, vertecProject, togglVertecProjects)))
            .then(values => values.join());
    }

    synchronizeVertecProjectWithTogglFor(workspaceId, vertecProject, togglVertecProjects) {
        const existingTogglVertecProjects = togglVertecProjects.filter(togglVertecProject => equal(vertecProject, togglVertecProject));

        if (existingTogglVertecProjects.length == 0) {
            const togglProjectName = createTogglProjectName(vertecProject);
            logger.info(`creating new toggl project '${togglProjectName}'`);

            const togglProject = {
                "wid": workspaceId,
                "name": togglProjectName
            };

            return this.toggl.createProjectAsync(togglProject);
        } else {
            const message = `vertec project '${createTogglProjectName(vertecProject)}' already exists in toggl: '${existingTogglVertecProjects[0].name}'`;
            logger.info(message);

            return Promise.resolve(message);
        }
    }

    synchronizeCurrentTogglTimeEntriesWithVertec() {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 35); // synchronize last 35 days
        const endDate = new Date(); // today

        return this.synchronizeTogglTimeEntriesWithVertecFromTo(startDate, endDate);
    }

    synchronizeTogglTimeEntriesWithVertecFromTo(startDate, endDate) {
        return this.toggl.getWorkspacesAsync()
            .then(workspaces => this.getTogglProjectsAndTimeEntriesFromTo(workspaces[0].id, startDate, endDate))
            .then(togglProjectsAndTimeEntries => this.synchronizeTogglTimeEntriesWithVertec(togglProjectsAndTimeEntries));
    }

    getTogglProjectsAndTimeEntriesFromTo(workspaceId, startDate, endDate) {
        return Promise.join(this.toggl.getWorkspaceProjectsAsync(workspaceId), this.toggl.getTimeEntriesAsync(startDate, endDate))
            .then(values => ({
                togglProjects: values[0],
                togglTimeEntries: values[1]
            }));
    }

    synchronizeTogglTimeEntriesWithVertec({togglProjects, togglTimeEntries}) {
        let togglTimeEntriesAndProjects = togglTimeEntries.map(togglTimeEntry => ({
            togglTimeEntry,
            togglProject: togglProjects.filter(p => p.id == togglTimeEntry.pid)[0]
        }));

        const togglTimeEntriesWithoutProjects = togglTimeEntriesAndProjects.filter(t => !t.togglProject);
        togglTimeEntriesWithoutProjects.forEach(t => logger.info(`not synchronizing time entry '${t.togglTimeEntry.description}'. no project assigend.`));
        togglTimeEntriesAndProjects = _.difference(togglTimeEntriesAndProjects, togglTimeEntriesWithoutProjects);

        const togglTimeEntriesWithNonMatchingVertecProject = togglTimeEntriesAndProjects.filter(t => !matchesVertecProject(t.togglProject))
        togglTimeEntriesWithNonMatchingVertecProject.forEach(t => logger.info(`not synchronizing time entry '${t.togglTimeEntry.description}'. no vertec project can be matched.`));
        togglTimeEntriesAndProjects = _.difference(togglTimeEntriesAndProjects, togglTimeEntriesWithNonMatchingVertecProject);

        const togglTimeEntriesWithUnknownVertecProjects = togglTimeEntriesAndProjects.filter(t => !this.isVertecProjectKnown(t.togglProject))
        togglTimeEntriesWithUnknownVertecProjects.forEach(t => logger.info(`not synchronizing time entry '${t.togglTimeEntry.description}'. no vertec project cached => try resyncing projects from vertec.`));
        togglTimeEntriesAndProjects = _.difference(togglTimeEntriesAndProjects, togglTimeEntriesWithUnknownVertecProjects);

        const togglTimeEntriesWithVertecTag = togglTimeEntriesAndProjects.filter(t => t.togglTimeEntry.tags && t.togglTimeEntry.tags.some(tag => tag == 'vertec'));
        togglTimeEntriesWithVertecTag.forEach(t => logger.info(`not synchronizing time entry '${t.togglTimeEntry.description}'. already synced to vertec.`));
        togglTimeEntriesAndProjects = _.difference(togglTimeEntriesAndProjects, togglTimeEntriesWithVertecTag);

        const togglTimeEntriesWithNonHalfHours = togglTimeEntriesAndProjects.filter(t => !durationIsMultipleOfThirtyMinutes(t.togglTimeEntry));
        togglTimeEntriesWithNonHalfHours.forEach(t => logger.info(`not synchronizing time entry '${t.togglTimeEntry.description}'. the duration is not a multitude of half hours.`));
        togglTimeEntriesAndProjects = _.difference(togglTimeEntriesAndProjects, togglTimeEntriesWithNonHalfHours);

        const vertecTimeEntriesToBeCreated = togglTimeEntriesAndProjects.map(t => this.createVertecTimeEntry(t.togglTimeEntry, t.togglProject));
        vertecTimeEntriesToBeCreated.forEach(v => logger.info(`synchronizing time entry '${v.data.text}'.`));

        if(vertecTimeEntriesToBeCreated.length == 0) {
            const message = "No time entries found to synchronize.";
            logger.info(message);

            return message;
        }
        
        return this.vertec.save(vertecTimeEntriesToBeCreated)
            .then(vertecResponse => {
                    logger.info(vertecResponse);

                    return this.toggl.addTimeEntriesTagsAsync(togglTimeEntriesAndProjects.map(t => t.togglTimeEntry.id), ['vertec']);
                });                            
    }

    isVertecProjectKnown(togglProject) {
        return this.getKnownVertecProjects(togglProject).length > 0;
    }

    getKnownVertecProject(togglProject) {
        return this.getKnownVertecProjects(togglProject)[0];
    }

    getKnownVertecProjects(togglProject) {
        const vertecProject = getVertecProjectMatch(togglProject);
        const vertecProjects = this.vertec.getVertecProjectsPhasesAndActivitiesCached();
        
        return vertecProjects.filter(p => equal(p, togglProject));
    }

    createVertecTimeEntry(togglTimeEntry, togglProject) {
        const className = 'OffeneLeistung';
        const vertecProject = this.getKnownVertecProject(togglProject);
        const data = {
            text: togglTimeEntry.description,
            datum: togglTimeEntry.start.substring(0, 10),
            minutenInt: togglTimeEntry.duration / 60,
            bearbeiter: { objref: vertecProject.bearbeiterId } ,
            projekt: { objref: vertecProject.projectId },
            phase: { objref: vertecProject.phaseId },
            typ: { objref: vertecProject.activityId }
        };

        return { className, data };
    }
}

function createTogglProjectName(vertecProject) {
    return `${vertecProject.phaseDescription} (${vertecProject.projectCode}/${vertecProject.phaseCode}/${vertecProject.activityCode})`;
}

function equal(vertecProject, togglProject) {
    const togglVertecProject = getVertecProjectMatch(togglProject);

    return togglVertecProject
        && vertecProject.projectCode == togglVertecProject.projectCode
        && vertecProject.phaseCode == togglVertecProject.phaseCode
        && vertecProject.activityCode == togglVertecProject.activityCode;
}

function matchVertecProject(togglProjectName) {
    const regExp = /(.+)\((.+)\/(.+)\/(.+)\)/;

    return regExp.exec(togglProjectName);
}

function matchesVertecProject(togglProject) {
    const match = matchVertecProject(togglProject.name);

    return match && match.length == 5;
}

function getVertecProjectMatch(togglProject) {
    if (!matchesVertecProject(togglProject)) {
        return null;
    }

    const match = matchVertecProject(togglProject.name);

    return {
        projectCode: match[2],
        phaseCode: match[3],
        phaseDescription: match[1],
        activityCode: match[4]
    };
}

function durationIsMultipleOfThirtyMinutes(togglTimeEntry) {
    const durationInMinutes = togglTimeEntry.duration / 60;

    return durationInMinutes % 30 === 0;
}

module.exports = {
    TogglVertec
}