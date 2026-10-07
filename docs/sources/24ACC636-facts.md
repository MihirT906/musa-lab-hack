# Carrier 24ACC636 Facts

Facts for the demo unit, taken from the manuals listed in [README.md](README.md). Every row cites a document and PDF page. Scenario briefs should use only values that appear here; anything listed under [Not in the sources](#not-in-the-sources) must be labelled as an assumption if a scenario needs it.

Document codes:

- **PD** = 24ACC6-9PD.pdf (Product Data, 05/19)
- **WD** = 24ACC6-3W.pdf (Wiring Diagrams, 06/19)
- **SI** = 24ACB-CC-PB-10SI.pdf (Installation Instructions, 09/20)
- **SM** = 24-25-2SM.pdf (general Carrier service manual, 04/08; not specific to the 24ACC6)

## Unit identity

| Fact | Value | Source |
| --- | --- | --- |
| Unit | 24ACC636, 3-ton (36,000 Btu/h) air conditioner, listed as size "36-31" | PD p. 2, 8 |
| Voltage | 208/230 V, single phase, 60 Hz | PD p. 8 |
| Refrigerant | Puron (R-410A), factory charge 6.75 lb | PD p. 2 |
| Compressor | Scroll, internal thermal overload, internal pressure relief valve | PD p. 1, 2 |
| Metering device | TXV (Puron hard shutoff) | PD p. 2 |
| Outdoor fan | Propeller, direct drive, 1/12 HP, 800 RPM, 3223 CFM | PD p. 2 |
| Standard protection | High-pressure switch, low-pressure switch, filter drier | PD p. 2 |

## Electrical data

| Fact | Value | Source |
| --- | --- | --- |
| Compressor rated load amps (RLA) | 13.6 A | PD p. 8 |
| Compressor locked rotor amps (LRA) | 79.0 A | PD p. 8 |
| Outdoor fan full load amps (FLA) | 0.50 A | PD p. 8 |
| Minimum circuit amps (MCA) | 17.5 A | PD p. 8 |
| Max fuse or breaker | 30 A (time-delay fuse) | PD p. 8 |
| Operating voltage limits | 197 V minimum; maximum printed as 235 V | PD p. 8 |
| Control circuit | 24 V, external source, 40 VA minimum transformer | PD p. 8; WD p. 1 note 4 |
| Contactor coil voltage when energized | 20 to 30 V | SM p. 11 |

The 235 V maximum is what the table prints. A 230 V unit would normally allow about 253 V, so this may be a misprint; do not build a scenario result on it.

## Wiring and components

From the 24ACC618-48 208/230-1 diagram (WD p. 1):

| Item | Detail |
| --- | --- |
| CONT (contactor) | Line L1 to terminals 11/21, L2 to terminals 23/23; coil in the 24 V circuit |
| CAP (capacitor) | One **dual run** capacitor with terminals H (compressor), C (common), F (fan) |
| COMP (compressor) | Terminals C, S, R; start winding wired to CAP terminal H |
| OFM (outdoor fan motor) | Wired to CAP terminal F |
| Optional parts | Start capacitor, start relay, start thermistor, crankcase heater, compressor time delay, liquid line solenoid ("may be factory or field installed") |
| Safety chain on Y | Low-pressure switch, discharge temperature switch, high-pressure switch, then time delay and contactor coil |
| Note 12 | Do not rapid cycle the compressor; it must be off 3 minutes before restarting |

## Sequence of operation

| Step | Source |
| --- | --- |
| On a call for cooling the thermostat makes R-Y and R-G | SI p. 7 |
| R-Y energizes the contactor, which starts the outdoor fan motor and compressor | SI p. 7 |
| R-G energizes the indoor blower relay, starting the indoor blower | SI p. 7 |
| When satisfied, the contactor and blower relay de-energize; a time-delay relay, if fitted, runs the blower 90 seconds longer | SI p. 7 |

## Capacitor check

All from SM p. 12.

| Fact | Value |
| --- | --- |
| Hazard | Capacitors store energy with power off; always check with power off |
| Discharge method | Short across terminals with a 15,000-ohm, 2-watt resistor, power off |
| Visual reject | Remove any capacitor that is bulging, dented, or leaking; do not apply power to it |
| Ohmmeter check | Disconnected, on R x 10k: reading should jump low and climb slowly. No movement means open; stays at 0 or low means shorted |
| Ground check | Each terminal to case; discard at half-scale deflection or less |
| Capacitance tolerance | Replace if not within ±10 percent of the value stated on the capacitor |
| Running calculation | Capacitance (mfd) = (2650 x amps) / volts, taken with power on under "extreme caution" |

## Other checks relevant to "no cooling"

| Component | Check | Source |
| --- | --- | --- |
| Contactor | Power off: contacts move freely, no severe burning; coil has continuity. Energized coil reads 20 to 30 V. Closed contacts read very low or 0 ohms with high voltage off | SM p. 11 |
| Outdoor fan motor | Check for loose connections or a defective fan motor capacitor. Thermal overload may be open; let it cool. Power off: continuity between the 3 leads, no resistance to ground | SM p. 19 |
| Compressor windings | Power off, capacitors discharged, wires removed: C-R, C-S, R-S each read near 0 ohms (usually under 10). An open reading means replace, once the internal overload has had time to reset | SM p. 22 |
| Low-pressure switch | Opens at about 50 psig on Puron; continuity when good | SM p. 13 |
| High-pressure switch | Opens around 610 psig, closes at 420 ± 25 psig on Puron. Causes include a dirty condenser coil or failed fan motor | SM p. 14 |

## Troubleshooting chart branches

From the Air Conditioner Troubleshooting Chart (SM p. 62, Fig. 42), under "No cooling or insufficient cooling". A defective run capacitor appears in two branches:

| Branch | Listed causes that include the capacitor |
| --- | --- |
| Compressor will not run, contactor closed | Compressor power supply open, loose leads at compressor, faulty start gear, open/shorted/grounded windings, compressor stuck, internal protection open, **defective run capacitor**, defective start capacitor |
| Compressor runs but cycles on internal overload | Outdoor fan stopped or cycling on overload (loose lead, motor defective, **incorrect OFM capacitor**), restricted outdoor air, overcharge, low charge, line voltage too high or low, **defective run capacitor**, compressor bearings, high superheat, defective start capacitor |

## Charging reference

| Fact | Value | Source |
| --- | --- | --- |
| Required subcooling, size 36 | 10°F | PD p. 8 |
| Tolerance | ±3°F | SI p. 4; WD p. 1 |
| Valid conditions for subcooling method | Outdoor 70 to 100°F, indoor 70 to 80°F | SI p. 8 |
| Run time before checking | 15 minutes | SI p. 7, 8 |
| Liquid line temperature for 10°F subcooling | 283 psig: 82°F; 317 psig: 90°F; 354 psig: 98°F; 395 psig: 106°F | SI p. 5 Table 2; WD p. 1 |

## Safety statements

| Statement | Source |
| --- | --- |
| Before servicing, the main disconnect must be OFF; there may be more than one disconnect. Lock out and tag the switch | SI p. 1 |
| Shut off all power before troubleshooting. Only trained service personnel should perform electrical troubleshooting | SM p. 11 |
| One side of the line may remain energized with a single-pole contactor | SM p. 11 |
| Defective capacitors may explode when power is applied | SM p. 12 |
| Never put face or body directly in line with compressor terminals | SM p. 22 |

## Not in the sources

These are not stated in any of the four documents. Read them from the unit's rating plate or capacitor label, or mark them as assumed in a scenario.

- **Run capacitor rating** (microfarads and voltage) for the 24ACC636. The diagram shows a dual run capacitor but gives no value.
- Compressor winding resistances for this model.
- Normal operating suction and head pressures for this model at given conditions.
- Contactor part number and whether it is single-pole or double-pole on this size.
