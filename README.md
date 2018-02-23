# toggl-vertec
toggl-vertec offers two functionalities:
1) It flattens and synchronizes your vertec projects into toggl projects to allow you to use them for your bookings in toggl.
2) Subsequently you can do all your bookings in toggl and toggl-vertec synchronizes them back to vertec. 

toggl-vertec only does a one time synchronization of new toggl time entries. It will never update or delete existing time entries in vertec, however you can easily do this manually if required.

## Installation & Configuration

    npm install -g toggl-vertec

Execute

    toggl-vertec

Initially toggl-vertec will ask you to enter the **vertec xml server url**. Enter the url of the server or confirm the default and download your companies' vertec xml server and place it under:

    c:\Program Files (x86)\vertec-xml-server\VertecServer.exe

Furthermore toggle-vertec will ask you for your **vertec user name** and your **toggl api token**, which can be found in your [toggl profile](https://toggl.com/app/profile).

Initially toggl-vertec will also automatically sync your projects from vertec to toggl.

## Usage

In order to synchronize vertec projects to toggl execute:

    toggl-vertec -p

All your vertec projects will be added to your toggl [projects list](https://toggl.com/app/projects/).
You can safely delete projects which you do not want to book on right now, they will be recreated once you synchronize again. In order to omit recreation you can black list projects, phases and activities in the configuration.js file which can be found inside the toggl-vertec app data folder.

You can safely rename the project's name in front of the brackets, toggl-vertec only needs the codes in the brackets in order to synchronize back the time entries later on.

Now you can start booking in toggl.
Before you synchronize back to vertec, assure you correct all entries to be multiples of 30 minutes, as toggl-vertec currently ignores them otherwise.
If you do not actually rely on the time tracking, the easiest way is to use toggl in [manual mode](https://support.toggl.com/creating-a-time-entry/#addtimelater).

In order to synchronize toggl time entries to vertec execute: 

    toggl-vertec

toggl-vertec reads all toggl entries of the last 35 days and synchronizes them to vertec.
Once an entry is synchronized it adds the 'vertec' tag to the time entry in toggl in order to not synchronize it again later on.
Time entries only get synchronized if a project can be found which has been synchronized before to toggl (see [project cache](#project-cache)).
Time entries to be synchronized must be multiples of 30 minutes, otherwise they are ignored.
Time entries having the 'vertec' tag are not being synchronized (again).

toggl-vertec will always ask you for your vertec password before accessing vertec. If you want to avoid that, you can add your password to the configuration.js file inside the toggl-vertec app data folder, however for security reasons this is not recommended.

## Additional options

Reset the vertec xml server location:

    toggl-vertec -r

This will reset the url and path, so toggl-vertec will ask you to enter the url again.

Set the vertec xml server url:

    toggl-vertec -v https://newvertecxmlserver.com/xml

The default is `http://127.0.0.1:8090/xml` which is used when the server is locally started by toggl-vertec. In this case the vertec xml server path is automatically set to `c:\Program Files (x86)\vertec-xml-server\VertecServer.exe` and you need to manually place the server binaries in this location.

Set the vertec xml server path:

    toggl-vertec -e "c:\Program Files (x86)\vertec-xml-server\VertecServer.exe"

This is only needed if toggl-vertec shall start the vertec xml server locally. If not set, then toggl-vertec does not try to start the vertec xml server itself.

Change vertec user name:

    toggl-vertec -u newusername

Change toggl api token:

    toggl-vertec -t newtogglapitoken

## Possible pifalls and additional details

### Company network
toggl-vertec must be able to connect to the vertec xml server, respectively the vertec xml server must be able to connect to the vertec database, so you most probably need to be connected to your company network, unless the database is publicly exposed.

### 30 mins validation
Time entries to be synchronized currently must be multiples of 30 minutes, otherwise they are ignored.

### Project format
The vertec project in toggl can have a random name, however it must end with normal brackets, containing the vertec project, phase and activity code separated by a slash.

    Random project name (PROJECTCODE/PHASECODE/ACTIVITYCODE)

### Project cache
Note that manual adding of projects is currently not supported, unless you add them also to the local project cache which is located in vertec-projects.json inside the toggl-vertec app data folder.

### Vertec tag
Time entries only get synchronized if they do not already have the vertec tag set in toggl.
When you add a new time entry in toggl, it proposes recently added entries having the same name.
If you select the proposal and add such an entry again, which has already being synchronized, toggl also automatically adds the vertec tag.
In this case you must manually delete the tag so that toggl-vertec recognizes it as not being synchonized yet.

Be aware, that if you remove the vertec tag from already synchronized entries, they will be synchronized again.
You can also use that to your advantage and edit already synchronized entries.
However in this case you manually need to remove the previous time entry in vertec.

### Update of already synchronized time entries
toggl-vertec does not update previously synchronized time entries, it only adds new ones.
In case you want to do that you can manually delete the entry in vertec and remove the vertec tag in toggl and the entry will be synchonized again.

## License
This software is licenced under ISC. See [LICENSE](LICENSE), please see the licences of the related 3rd party libraries below.

## Acknowledgements
toggl-vertec is based on the following great open source projects:
* [bluebird](https://github.com/petkaantonov/bluebird/) [(MIT)](https://github.com/petkaantonov/bluebird/blob/master/LICENSE)
* [command-line-args](https://github.com/75lb/command-line-args) [(MIT)](https://github.com/75lb/command-line-args/blob/master/LICENSE)
* [jsonfile](https://github.com/jprichardson/node-jsonfile) [(MIT)](https://github.com/jprichardson/node-jsonfile/blob/master/LICENSE)
* [lodash](https://github.com/lodash/lodash) [(MIT)](https://github.com/lodash/lodash/blob/master/LICENSE)
* [mocha](https://github.com/mochajs/mocha) 
* [prompt-sync](https://github.com/0x00A/prompt-sync) [(MIT)](http://spdx.org/licenses/MIT.html) [(MIT)](https://github.com/mochajs/mocha/blob/master/LICENSE)
* [simple-vertec-api](https://github.com/dimitri-koenig/simple-vertec-api) [(MIT)](http://opensource.org/licenses/MIT)
* [toggl-api](https://github.com/7eggs/node-toggl-api) [(MIT)](https://github.com/7eggs/node-toggl-api/blob/master/LICENSE)
* [winston](https://github.com/winstonjs/winston) [(MIT)](https://github.com/winstonjs/winston/blob/master/LICENSE)

## Disclaimer
toggl-vertec adds time entries to vertec using the xml vertec server.
The xml vertec server is provided by vertec and does the necessary validation.
Furthermore toggl-vertec does validation and only adds entries to known projects.
There is no guarantee, that all toggl entries get synchronized.
You are personally responsible for checking that all entries have been synchronized, nothing got lost on the way and all time entries are valid.
Be aware that toggl-vertec synchronizes all your vertec project names and codes to the toggl servers, which may be against your corporate or client policies.
