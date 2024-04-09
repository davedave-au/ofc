/**
 * This script is used to update the fixtures, teams and weekly ground setup sheets
 * from the dribl API in to the installed Google Sheets document.
 * 
 * Each year you will need to update the dribl variables such as 
 * DRIBL_SEASON, DRIBL_COMPETITION, DRIBL_CLUB and DRIBL_TENANT.
 * And probably change the whole script to match the new dribl API ;)
 * 
 * @author: David Watson
 * @version: 1.0
 * @date: 2024-04-09
 */

const DRIBL_SEASON      = '3pmvvPRmvJ';
const DRIBL_COMPETITION = '3pmvZw6mvJ';
const DRIBL_CLUB        = 'wxNx5LOKkp';
const DRIBL_TENANT      = 'b6lNb6NxE2';
const DATE_LIMIT_DAYS   = 31;
const CLUB_NAME         = 'Oatley Football Club';
const CLUB_GROUND_NAMES = ['Carinya School Fields','Renown Park','The Green'];
const FIXTURES_SHEET    = 'Fixtures';
const TEAMS_SHEET       = 'Teams';
const WEEK_START_DAY    = 1 // Monday

var ui = null;

/**
 * Recursive function that gets the matches from the dribl API
 * 
 * @param String cursor returned from the previous API call
 * @returns 
 */
function getMatches(cursor = null) {
  var queryUrl = 'https://mc-api.dribl.com/api/fixtures?date_range=default';
  queryUrl += '&season=' + DRIBL_SEASON;
  queryUrl += '&competition=' + DRIBL_COMPETITION;
  queryUrl += '&club=' + DRIBL_CLUB;
  queryUrl += '&tenant=' + DRIBL_TENANT;
  if (cursor != null) {
    queryUrl += '&cursor=' + cursor;
  }

  var response = UrlFetchApp.fetch(queryUrl);
  var json = response.getContentText();
  var fixtures = JSON.parse(json);

  var dateLimit = new Date();
  dateLimit.setDate(dateLimit.getDate() + DATE_LIMIT_DAYS);

  var data = [];
  var latestDate = new Date();
  if (fixtures.data != null && fixtures.data.length > 0) {
    fixtures.data.forEach((fixture) => {
      const match = fixture.attributes;
      const matchDate = Date.parse(match.date);
      if (matchDate > latestDate) {
        latestDate = matchDate;
      }
      if (matchDate > dateLimit) {
        return;
      }

      var matchData = [
        fixture.hash_id,
        match.match_hash_id,
        match.date,
        match.league_name,
        match.round,
        match.status,
        match.name,
        match.home_team_name,
        match.away_team_name,
        match.ground_name,
        match.field_name
      ];
      data.push(matchData);
    });
  }

  if (data.length > 0 && fixtures.meta.next_cursor != null && latestDate < dateLimit) {
    data = data.concat(getMatches(fixtures.meta.next_cursor));
  }

  return data;
}

/**
 * Creates or updates the fixtures sheet with the new fixtures
 * @param String[][] newRecords new match records
 */
function updateFixturesSheet(newRecords) {
  var matches = [...newRecords];
  var sheet = SpreadsheetApp.getActive().getSheetByName(FIXTURES_SHEET);
  if (sheet == null) {
    sheet = SpreadsheetApp.getActive().insertSheet(FIXTURES_SHEET);
    sheet.appendRow([
      'Fixture ID',
      'Match ID',
      'Date',
      'League',
      'Round',
      'Status',
      'Name',
      'Home Team',
      'Away Team',
      'Ground',
      'Field'
    ]);
  }

  // Read the old fixtures data
  const lr = sheet.getLastRow();
  var destRange = [];
  if (lr > 1) {
    destRange = sheet.getRange(2, 1, lr - 1, 11).getValues();
  }

  // Update the old fixtures data with new data and remove
  // those entries from the matches data to then append the rest
  const updateValues = destRange.map((row) => {
    for (const [i, match] of matches.entries()) {
      if (match[0] == row[0]) {
        matches.splice(i,1);
        return match;
      }
    }
    // If not found, return the original row
    return row;
  });

  const values = [...updateValues, ...matches];
  // Test here now
  // console.log('Matches New Length: ' + matches.length);
  // console.log('Updates Length: ' + updateValues.length);
  // console.log('Total Length: ' + values.length);
  // console.log('Range Length: ' + destRange.length);

  // Write all of the data to the fixtures sheet
  sheet.getRange(2, 1, values.length, 11).setValues(values);

  return true;
}

/**
 * Creates or updates the teams sheet with the new team names
 * @param String[][] newRecords new match records
 */
function updateTeamsSheet(newRecords) {
  var matches = [...newRecords];
  // Look through matches data to find home and away team names
  var teamNames = new Set();
  for (var match of matches) {
    // Add the home team
    if (match[7] != null && match[7].startsWith(CLUB_NAME)) {
      teamNames.add(match[7]);
    }
    // Add the away team
    if (match[8] != null && match[8].startsWith(CLUB_NAME)) {
      teamNames.add(match[8]);
    }
  }

  // Update the teams sheet
  var sheet = SpreadsheetApp.getActive().getSheetByName(TEAMS_SHEET);
  if (sheet == null) {
    sheet = SpreadsheetApp.getActive().insertSheet(TEAMS_SHEET);
    sheet.appendRow([
      'Team',
      'Coach Contacts',
      'Manager Contacts',
      'Player Contacts'
    ]);
  }

  // Read the old teams data
  const lr = sheet.getLastRow();
  var destRange = [];
  if (lr > 1) {
    destRange = sheet.getRange(2, 1, lr - 1, 4).getValues();
  }

  const newRows = Array.from(teamNames).filter((teamName) => {
    for (var i = 0; i < destRange.length; i++) {
      if (destRange[i][0] == teamName) return false;
    }
    return true;
  }).map((teamName => [teamName, '', '', '']));
  var values = [...destRange, ...newRows];
  values = values.sort(((a, b) => a[0].localeCompare(b[0])));

  sheet.getRange(2, 1, values.length, 4).setValues(values);
}

/**
 * Creates or updates the weekly ground setup sheet
 * @param Date weekDate 
 */
function updateWeekSheet(weekDate) {
  if (weekDate == null) {
    weekDate = new Date();
    weekDate.setDate(weekDate.getDate() - 1);
  }
  const sheetName = "Week " + weekDate.toLocaleDateString('en-us', { month:"short", day:"numeric"});
  var sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (sheet != null) {
    sheet.clear();
  } else{
    sheet = SpreadsheetApp.getActive().insertSheet(sheetName, 0);
  }
  sheet.appendRow([
    'Date',
    'Ground',
    'Field',
    'Team',
    'Coach Contacts',
    'Manager Contacts',
    'Player Contacts'
  ]);

  // Look through fixtures sheets for all matches within the dates
  var fixturesSheet = SpreadsheetApp.getActive().getSheetByName(FIXTURES_SHEET);
  const lr = fixturesSheet.getLastRow();
  var matches = [];
  if (lr > 1) {
    matches = fixturesSheet
      .getRange(2, 1, lr - 1, 11)
      .getValues()
      .filter((row) => {
        var matchDate = new Date(row[2]);
        var daysDiff = (matchDate.getTime() - weekDate.getTime()) / (1000 * 60 * 60 * 24);
        return (daysDiff > 0 && daysDiff <= 7);
      })
      .sort((a, b) => a[2] < b[2] ? -1 : 1);
  }
  var groundSetup = new Map();
  for (var match of matches) {
    var groundKey = match[9] + '-' + match[10];
    if (!CLUB_GROUND_NAMES.includes(match[9]) || groundSetup.has(groundKey)) {
      continue;
    }
    var setupTeam = (match[7] != null && match[7].startsWith(CLUB_NAME))
      ? match[7]                                                // If club is home
      : (match[8] != null && match[8].startsWith(CLUB_NAME))
      ? match[8]                                                // Else if club is away
      : match[7];                                               // Else home team regardless
    groundSetup.set(groundKey, [match[2], match[9], match[10], setupTeam]);
  }

  var values = Array.from(groundSetup.values());
  for (var i = 0; i < values.length; i++) {
    values[i] = [...values[i], '=vlookup(D' + (i + 2) + ',Teams!A2:D201,2,false)', '=vlookup(D' + (i + 2) + ',Teams!A2:D201,3,false)', '=vlookup(D' + (i + 2) + ',Teams!A2:D201,4,false)'];
  }

  sheet.getRange(2, 1, values.length, 7).setValues(values);

}

/**
 * Core method that updates the sheets with the new match data
 * @returns boolean success
 */
function updateSheets() {
  const matches = getMatches();
  if (matches.length == 0) {
    var errorMsg = 'No data received.';
    if (ui != null) {
      SpreadsheetApp.getUi().alert(errorMsg);
    } else {
      console.log(errorMsg)
    }
    return;
  }

  var earliestChangedFixtureDay = matches.reduce((a,b)=> (b[2] && b[2] < a) ? b[2] : a, matches[0][2]);
  var earliestChangedFixtureDate = new Date(earliestChangedFixtureDay);
  var latestChangedFixtureDay = matches.reduce((a,b)=> (b[2] && b[2] > a) ? b[2] : a, matches[0][2]);
  var latestChangedFixtureDate = new Date(latestChangedFixtureDay);

  updateFixturesSheet(matches);
  updateTeamsSheet(matches);

  // Work out which
  const firstSheetMonday = new Date();
  firstSheetMonday.setTime(earliestChangedFixtureDate.getTime());
  firstSheetMonday.setDate(firstSheetMonday.getDate() - ((firstSheetMonday.getDay() + (7 - WEEK_START_DAY)) % 7));
  firstSheetMonday.setHours(0,0,0,0);

  const lastSheetMonday = new Date();
  lastSheetMonday.setTime(latestChangedFixtureDate.getTime());
  lastSheetMonday.setDate(lastSheetMonday.getDate() - ((lastSheetMonday.getDay() + (7 - WEEK_START_DAY)) % 7));
  lastSheetMonday.setHours(0,0,0,0);

  for (var i = firstSheetMonday; i <= lastSheetMonday; i.setDate(i.getDate() + 7)) {
    updateWeekSheet(i)
  }

  return true;
}

/**
 * @OnlyCurrentDoc
 */
function onOpen() {
  ui = SpreadsheetApp.getUi();
  ui.createMenu("Custom Menu")
      .addItem("Get match info","updateSheets")
      .addToUi();
}