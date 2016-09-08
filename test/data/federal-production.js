/* jshint node: true, mocha: true */
/* jshint -W089 */
/* jshint -W110 */
var tito = require('tito');
var fs = require('fs');
var path = require('path');
var yaml = require('js-yaml');
var assert = require('assert');
var async = require('async');



var OUT_PATH = path.join(__dirname, '../../_data');

var load = function(filename, format, done) {
  var rows = [];
  fs.createReadStream(filename, 'utf8')
    .pipe(tito.formats.createReadStream(format))
    .on('data', function(d) {
      rows.push(d);
    })
    .on('error', done)
    .on('end', function() {
      done(null, rows);
    });
};

var loadAll = function(dir, done) {
  fs.readdir(dir, function(error, files) {
    if (error) {
      return done(error);
    }
    async.mapSeries(files, function(filename, next) {
      filename = path.join(dir, filename);
      var ext = filename.split('.').pop();
      load(filename, ext, next);
    }, function(error, files) {
      done(error, (files || []).reduce(function(rows, data) {
        return rows.concat(data);
      }, []));
    });
  });
};


describe('federal production (ONRR)', function() {

  describe('national values', function() {

    var nationalValues = yaml.safeLoad(
      fs.readFileSync(
        path.join(OUT_PATH, 'national_federal_production.yml'),
        'utf8'
      )
    );
    var products = nationalValues.US.products;

    it('check sentinel values', function(done) {

      // Oil | 2013: 623,103,687.09 barrels
      // Salt | 2015: 764,801 tons
      // Salt | 2006: 512,832 tons
      // Gas | 2013: 4,941,408,110

      var product;
      var year;
      var volume;
      var units;
      var matches;
      var match;
      var filter = function(d) {
        return d.region === 'US'
            && d.product === product
            && d.year === year;
      };

      var salt2006 = products['Salt (tons)'].volume[2015]
      var salt2015 = products['Salt (tons)'].volume[2015]
      var oil2013 = products['Oil (bbl)'].volume[2013]


      for (product in products) {
        for (year in products[product].volume) {
          volume = products[product].volume[year];
          units = products[product].units;
          matches = rows.filter(filter);
          assert.equal(matches.length, 1);
          match = matches[0];
          assertVolumeMatch(
            match.volume,
            match.units,
            volume,
            units
          );
        }
      }
      done();
    });



  });

  describe('state values', function() {

    var stateValues = yaml.safeLoad(
      fs.readFileSync(
        path.join(OUT_PATH, 'state_federal_production.yml'),
        'utf8'
      )
    );

    // it('all state input rows exist in YAML', function(done) {
    //   loadAll(IN_PATH, function(error, rows) {
    //     if (error) {
    //       return done(error);
    //     }

    //     var volume;

    //     rows
    //       .filter(function(d) {
    //         return d.region !== 'US'
    //             && d.region.length === 2
    //             && d.volume;
    //       })
    //       .forEach(function(d) {
    //         var dataPath = [d.region, 'products', d.product, 'volume', d.year];
    //         var product;
    //         try {
    //           product = stateValues[d.region].products[d.product];
    //           volume = product.volume[d.year].volume;
    //         } catch (error) {
    //           throw new Error('no YAML data for row: ' + dataPath.join('.')
    //                          + ' ' + JSON.stringify(d));
    //         }

    //         assertVolumeMatch(
    //           d.volume,
    //           d.units,
    //           volume,
    //           product.units
    //         );
    //       });

    //     done();
    //   });
    // });

    // it('all YAML values exist in the input data', function(done) {
    //   loadAll(IN_PATH, function(error, rows) {
    //     if (error) {
    //       return done(error);
    //     }

    //     var state;
    //     var product;
    //     var year;
    //     var volume;
    //     var units;
    //     var matches;
    //     var match;
    //     var filter = function(d) {
    //       return d.region === state
    //           && d.product === product
    //           && d.year === year;
    //     };

    //     for (state in stateValues) {
    //       for (product in stateValues[state].products) {
    //         var values = stateValues[state].products[product];
    //         units = values.units;
    //         for (year in values.volume) {
    //           volume = values.volume[year].volume;
    //           matches = rows.filter(filter);
    //           assert.equal(matches.length, 1);
    //           match = matches[0];
    //           assertVolumeMatch(
    //             match.volume,
    //             match.units,
    //             volume,
    //             units
    //           );
    //         }
    //       }
    //     }

    //     done();
    //   });
    // });
  });

  describe('offshore values', function() {
  });

});
