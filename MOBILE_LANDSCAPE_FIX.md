# Mobile landscape / short viewport fix

The opening-memory screen was still using desktop-sized cards on landscape phones.

Fixed:
- Opening screen can scroll vertically when browser chrome reduces usable height.
- Opening modal is much shorter and wider in landscape.
- Opening cards shrink to 72px, or 60px on very short screens.
- All four cards remain on one row in landscape.
- Heading/instructions are reduced to preserve vertical space.
- Selection count and MEMORIZE button remain visible.
- Special-action, result, and Perfect Eclipse screens also receive short-landscape adjustments.
