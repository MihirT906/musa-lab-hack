# Source Documents

Reference manuals used to ground FieldReady scenarios. Equipment family: **Carrier 24ACC6 residential split-system air conditioner (Puron / R-410A), 1-1/2 to 5 tons**.

Retrieved 2026-10-07. The Carrier manuals are copyrighted, so they are not committed; run `scripts/fetch_sources.sh` from the repo root to download them into this folder. The OSHA publications are committed as unmodified copies.

## Equipment-specific

Use these for simulated readings, component checks, and procedures.

| File | Title | Publisher | Catalog No. | Edition | Pages | Source URL |
| --- | --- | --- | --- | --- | --- | --- |
| [24-25-2SM.pdf](24-25-2SM.pdf) | Residential Air Conditioners and Heat Pumps Using R-22 and Puron Refrigerant: Application Guideline and Service Manual | Carrier | 24-25-2SM | 04/08 | 66 | https://www.shareddocs.com/hvac/docs/1009/Public/07/24-25-2SM.pdf |
| [24ACB-CC-PB-10SI.pdf](24ACB-CC-PB-10SI.pdf) | 24ACB3, 24ACC6, 24APB6 Performance Series Air Conditioners with Puron Refrigerant: Installation Instructions | Carrier | 24ACB-CC-PB-10SI | 09/20 | 10 | https://www.shareddocs.com/hvac/docs/1009/Public/06/24ACB-CC-PB-10SI.pdf |
| [24ACC6-3W.pdf](24ACC6-3W.pdf) | 24ACC6 Comfort Series Air Conditioner: Wiring Diagrams | Carrier | 24ACC6-3W | 06/19 | 2 | https://www.shareddocs.com/hvac/docs/1009/Public/03/24ACC6-3W.pdf |
| [24ACC6-9PD.pdf](24ACC6-9PD.pdf) | 24ACC6 Performance 16 Air Conditioner with Puron Refrigerant: Product Data | Carrier | 24ACC6-9PD | 05/19 | 20 | https://www.shareddocs.com/hvac/docs/1009/Public/07/24ACC6-9PD.pdf |

Where to look:

- **Service manual:** capacitor checks (p. 12), contactor, pressure switches, fan motor, compressor failures, and the AC troubleshooting chart (p. 59).
- **Installation instructions:** start-up, electrical connections, subcooling table (Table 2) and superheat charging table (Table 3) on pp. 4-6.
- **Wiring diagrams:** 208/230-1 schematic for mapping simulated voltage checks to terminals.
- **Product data:** specifications and listed components.

## General safety context

Use these for safety framing and scoring only, not for equipment-specific readings.

| File | Title | Publisher | Number | Pages | Source URL |
| --- | --- | --- | --- | --- | --- |
| [OSHA3075.pdf](OSHA3075.pdf) | Controlling Electrical Hazards | OSHA | OSHA 3075 (2002) | 71 | https://www.osha.gov/sites/default/files/publications/OSHA3075.pdf |
| [OSHAFS3529.pdf](OSHAFS3529.pdf) | Lockout/Tagout Fact Sheet | OSHA | OSHA FS-3529 (2022) | 2 | https://www.osha.gov/sites/default/files/publications/OSHAFS3529.pdf |

## Caveats

- The service manual is Carrier's general manual for its residential split systems and dates from 2008, about eleven years before the other 24ACC6 documents. It does not name the 24ACC6 in its text; confirm it applies before citing it as the model's service manual.
- The wiring diagram labels the 24ACC6 "Comfort Series" while the installation instructions and product data label it "Performance". This is assumed to be a naming change between revisions and has not been confirmed.
- The Carrier documents are copyrighted by Carrier and are gitignored (`docs/sources/24*.pdf`). OSHA publications are U.S. government works.
