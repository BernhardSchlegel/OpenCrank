# OpenCrank

<img src="logo.png" alt="OpenCrank logo" width="120">

Forever free indoor cycle training

<img width="1080" height="2340" alt="Screenshot_20260602_175008_Chrome (1)" src="https://github.com/user-attachments/assets/445a26e1-fbff-4501-947b-127892db7758" />

## Why?
If you don't get why you should pay $15 per month to set the wattage of you Hometrainer: this is for you. Sure: You'll loose horrible 3D graphics.

## How?

Download this repo and open `/dist/opencrank.html` in your browser. Or go [opencrank.burnybikes.com](https://opencrank.burnybikes.com/).

## Features

- No setup required - just launch the website in you browser (chrome preferred) - feel free to use a local HTML file
- Set the wattage 
- Read the wattage and crank RPM
- Tested on Kickr Core 2

## Next steps

- [x] Set your FTP / weight to display zone
- [x] Display historic wattage over past minutes
- [x] Predefine trainings based on current science (use JSON to make it easily extendable), e.g. "Rønnestad-Intervals"
- [x] When you're in training mode, make it easy to make it a bit harder / easier with dedicated buttons
- [ ] Create a cool logo

## Guiding principles 

- Always vibe code
- Always compile into a single HTML file
- No backend, everything is stored in your browser

## For devs

`npm run build` to build new version.
