# guacamole-webclient-test

Author: James Caple
Date: 7/18/2019

Functional patch test for guacamole-common-js BlobWriter bug.

[Guacamole Jira Bug](https://issues.apache.org/jira/browse/GUACAMOLE-827)

## Quick Overview

This project is an Angular front-end to a 1.0 Guacamole Server.  It connects to a specified remote desktop and
allows a user to drag-and-drop local files to the remote desktop via RDP.  This code is developed to exemplify a problem
in the guacamole-common-js 1.0.0 BlobWriter.js file as documented in https://issues.apache.org/jira/browse/GUACAMOLE-827.

To run this code:

```
git clone https://github.com/jcaple/guacamole-webclient-test.git
cd guacamole-webclient-test
npm i
ng serve
```

This will run the Angular Web Client on port 4200.  The client 'talks' to the guacamole server running on localhost:9999.  To get that server running, refer to [https://github.com/jcaple/guacamole-server-test](https://github.com/jcaple/guacamole-server-test).
