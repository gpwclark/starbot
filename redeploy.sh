#!/bin/bash

if [[ ! $(which heroku) ]]; then
	echo "download the heroku cli."
	exit 1
fi
heroku plugins:install heroku-releases-retry && heroku releases:retry --app cs-uant-chaosmonkey

