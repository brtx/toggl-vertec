const assert = require('assert');

const Configuration = require('../configuration.js');

const VertecClient = require('../vertec.js').VertecClient;
const vertec = new VertecClient(Configuration);

const TogglVertec = require('../toggl-vertec.js').TogglVertec;
const togglVertec = new TogglVertec(Configuration);

const Promise = require('bluebird');
const TogglClient = require('toggl-api');
var toggl = Promise.promisifyAll(new TogglClient({ apiToken: Configuration.togglApiToken }), { context: toggl });

describe('vertec', function() {
  describe('#getOwnProjects()', function() {
    it('should get all active projects for bearbeiter', function() {
    return vertec
        .getOwnProjects()
        .then(projects => {
            // console.log(projects);

            assert(projects.some(p => p.aktiv))
        })
        .catch(console.log);
    });
  });
});

describe('vertec', function() {
  describe('#getOwnPhases()', function() {
    it('should get all active phases for first project', function() {
    return vertec
        .getOwnProjects()
        .then(projects => vertec.getOwnPhasesForProject(projects[0].code))
        .then(phases => 
          { return assert(phases.some(p => p.aktiv)) }
        )
        .catch(console.log);
    });
  });
});

describe('vertec', function() {
  describe('#getOwnPhases()', function() {
    it('should get all active phases for C20705', function() {
    return vertec
        .getOwnProjects()
        .then(projects => vertec.getOwnPhasesForProject('C20705'))
        .then(phases => { 
            console.log(phases);

            return assert(phases.some(p => p.aktiv)) 
            })
        .catch(console.log);
    });
  });
});

describe('vertec', function() {
  describe('#getOwnActivities()', function() {
    it('should get all active activities for first project', function() {
    return vertec
        .getOwnProjects()
        .then(projects =>
            vertec.getOwnActivities(projects[0].code)
              .then(activities => {
                  // console.log(activities);

                  return assert(activities.some(p => p.aktiv));
              }))
        .catch(console.log);
    });
  });
});

describe('vertec', function() {
  describe('#getOwnActivities()', function() {
    it('should get all active activities for first project', function() {
    return vertec
        .getOwnProjects()
        .then(projects =>
            vertec.getOwnActivities('C21588')
              .then(activities => {
                  console.log(activities);

                  return assert(activities.some(p => p.aktiv));
              }))
        .catch(console.log);
    });
  });
});

describe('vertec', function() {
  describe('#getOwnPhases()', function() {
    it('should get the pases', function() {
    return vertec
        .getOwnPhases()
        .then(phases => console.log(phases))
        .catch(console.log);
    });
  });
});

describe('vertec', function() {
  describe('#getVertecProjectsPhasesAndActivities()', function() {
    it('should get a flattened list of projects, phases and activities', function() {
    return vertec
        .getVertecProjectsPhasesAndActivitiesFromVertec()
        .then(console.log)
        .catch(console.log);
    });
  });
});

describe('togglVertec', function() {
  describe('#synchronizeVertecProjectsWithToggl()', function() {
    it('should synchronize vertec projects to toggle', function() {
    return togglVertec
        .synchronizeVertecProjectsWithToggl()
        .then(console.log)
        .catch(console.log);
    });
  });
});

describe('togglVertec', function() {
  describe('#synchronizeVertecProjectsWithToggl()', function() {
    it('should synchronize vertec projects to toggle', function() {
    let startDate = `${'2017-05-12'}T00:00:00.000Z`;
    let endDate = `${'2017-05-12'}T23:59:59.999Z`;

    return togglVertec
        .synchronizeTogglTimeEntriesWithVertecFromTo(startDate, endDate)
        .then(console.log)
        .catch(console.log);
    });
  });
});

describe.only('toggl', function() {
  describe('#getTimeEntriesAsync()', function() {
    it('should get toggl entries', function() {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 35); // synchronize last 35 days
    const endDate = new Date(); // today

    return toggl.getTimeEntriesAsync(startDate, endDate)
        .then(console.log)
        .catch(console.log);
    });
  });
});
