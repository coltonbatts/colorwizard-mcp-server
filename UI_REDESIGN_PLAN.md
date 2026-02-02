# UI Redesign Plan - Next Iteration

## Current State Summary
- `/three-blueprint` page is functional
- Mock mode provides instant preview with real DMC RGB values
- Thread list matches preview and percentages sum to 100%
- Dev server stable

---

## Layout Specifications

### Desktop Layout (≥1024px)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ HEADER                                                                  │
│ ┌───────────────────────────────────────────────────────────────────┐ │
│ │ Blueprint                    [Mock/Live API badge]                │ │
│ │ Colors Used: 18  |  Threads Needed: 15                            │ │
│ └───────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ┌───────────────────────────────────────────────────────────────────┐ │
│ │ PRIMARY CONTROL: Colors Used                                       │ │
│ │ ┌─────────────────────────────────────────────────────────────┐ │ │
│ │ │ [2]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[40] │ │ │
│ │ │                    ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │ │ │
│ │ │                                18                            │ │ │
│ │ └─────────────────────────────────────────────────────────────┘ │ │
│ │ More colors = higher fidelity, more thread changes              │ │
│ │ Threads Needed: 15                                               │ │
│ └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ┌──────────────────┐  ┌─────────────────────────────────────────────┐ │
│ │ REFERENCE IMAGE  │  │ BLUEPRINT OUTPUT (PRIMARY)                   │ │
│ │ [Collapsed: ▼]  │  │ ┌─────────────────────────────────────────┐ │ │
│ │                  │  │ │                                         │ │ │
│ │ [When expanded]  │  │ │         Large Canvas View               │ │ │
│ │ ┌──────────────┐ │  │ │         (ThreeJS Blueprint)            │ │ │
│ │ │              │ │  │ │                                         │ │ │
│ │ │   Image      │ │  │ │                                         │ │ │
│ │ │   Preview    │ │  │ │                                         │ │ │
│ │ │              │ │  │ │                                         │ │ │
│ │ └──────────────┘ │  │ │                                         │ │ │
│ │                  │  │ └─────────────────────────────────────────┘ │ │
│ │ (1/4 width)      │  │                                             │ │
│ └──────────────────┘  │ (3/4 width, full height)                    │ │
│                        └─────────────────────────────────────────────┘ │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ┌───────────────────────────────────────────────────────────────────┐ │
│ │ ADVANCED OPTIONS [Collapsed by default: ▶]                        │ │
│ │ (Hidden unless expanded)                                           │ │
│ └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ┌───────────────────────────────────────────────────────────────────┐ │
│ │ THREAD LIST (PRIMARY DELIVERABLE)                                  │ │
│ │ ┌─────────────────────────────────────────────────────────────┐ │ │
│ │ │ Thread List (18 colors)              [Copy Thread List]      │ │ │
│ │ ├─────────────────────────────────────────────────────────────┤ │ │
│ │ │ ┌────┐ DMC-310  Black              45.2%                    │ │ │
│ │ │ │    │                                                       │ │ │
│ │ │ └────┘                                                       │ │ │
│ │ │ ┌────┐ DMC-666  Bright Red         23.1%                    │ │ │
│ │ │ │    │                                                       │ │ │
│ │ │ └────┘                                                       │ │ │
│ │ │ ┌────┐ DMC-321  Christmas Red      12.5%                    │ │ │
│ │ │ │    │                                                       │ │ │
│ │ │ └────┘                                                       │ │ │
│ │ │ ... (scrollable)                                            │ │ │
│ │ └─────────────────────────────────────────────────────────────┘ │ │
│ │                                                                 │ │ │
│ │ Large, readable, feels like the final deliverable              │ │ │
│ └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Mobile Layout (<768px)

```
┌─────────────────────────────┐
│ HEADER                      │
│ Blueprint                   │
│ Colors: 18 | Threads: 15   │
│ [Mock/Live badge]           │
├─────────────────────────────┤
│                             │
│ PRIMARY CONTROL             │
│ Colors Used                 │
│ [2]━━━━━━━━━━━━━━━━━━[40]  │
│        ●━━━━━━━━━━━━━━━━    │
│           18                │
│ Threads Needed: 15          │
│                             │
├─────────────────────────────┤
│                             │
│ BLUEPRINT OUTPUT            │
│ ┌─────────────────────────┐ │
│ │                         │ │
│ │   Large Canvas View     │ │
│ │   (Full width)          │ │
│ │                         │ │
│ └─────────────────────────┘ │
│                             │
├─────────────────────────────┤
│                             │
│ REFERENCE IMAGE             │
│ [Collapsed: ▼]              │
│ (Hidden by default)         │
│                             │
├─────────────────────────────┤
│                             │
│ ADVANCED OPTIONS            │
│ [Collapsed: ▶]              │
│ (Hidden by default)         │
│                             │
├─────────────────────────────┤
│                             │
│ THREAD LIST                 │
│ Thread List (18 colors)     │
│ [Copy Thread List]          │
│ ┌─────────────────────────┐ │
│ │ ┌──┐ DMC-310  Black     │ │
│ │ │  │             45.2% │ │
│ │ └──┘                    │ │
│ │ ┌──┐ DMC-666  Red       │ │
│ │ │  │             23.1% │ │
│ │ └──┘                    │ │
│ │ ... (scrollable)        │ │
│ └─────────────────────────┘ │
│                             │
└─────────────────────────────┘
```

---

## Prioritized Task List

### Must-Do (Next Commit)

1. **Reorganize Header Stats**
   - Move "Colors Used" and "Threads Needed" to header as primary stats
   - Make them large, prominent, and always visible
   - Remove duplicate "Colors" and "Threads" from current header location

2. **Elevate Colors Used Control**
   - Move Colors Used slider to top of page (below header, above everything)
   - Make it visually prominent (larger, more spacing)
   - Keep "Threads Needed" display directly below slider
   - Remove it from BlueprintControls component's current position

3. **Reference Image Collapse**
   - Ensure reference image panel is collapsed by default on mobile
   - On desktop, keep it collapsible but default to expanded (smaller width)
   - Reduce desktop width from current 3/12 to 2/12 or 3/12 max

4. **Blueprint Output Dominance**
   - Increase canvas height on desktop (current 800px → 900-1000px)
   - Ensure full-width on mobile
   - Remove any competing visual weight from reference image

5. **Thread List Prominence**
   - Increase font sizes in thread list items
   - Make color swatches larger (current 16x16 → 20x20 or 24x24)
   - Increase spacing between items
   - Make DMC code and name more readable (larger font, better contrast)
   - Ensure "Thread List" header is prominent

6. **Advanced Options Hidden**
   - Verify Advanced Options is collapsed by default
   - Ensure it's clearly marked as optional/advanced
   - Keep all toggles (Mock Mode, High Quality, etc.) inside Advanced

### Nice-to-Have (Future Iterations)

1. **Visual Hierarchy Refinements**
   - Add subtle visual separation between sections
   - Improve spacing and breathing room
   - Consider subtle background color variations

2. **Thread List Enhancements**
   - Add "Export Thread List" button (CSV/PDF options)
   - Add search/filter within thread list
   - Show thread count badge on header

3. **Reference Image Improvements**
   - Add zoom/pan controls for reference image
   - Show image dimensions/metadata
   - Add side-by-side comparison mode toggle

4. **Mobile Optimizations**
   - Sticky header with stats on scroll
   - Bottom sheet for controls on mobile
   - Swipe gestures for reference image toggle

5. **Accessibility**
   - Keyboard navigation for all controls
   - Screen reader optimizations
   - High contrast mode option

---

## Acceptance Criteria

### Layout & Hierarchy
- [ ] Colors Used slider is the first control visible below header
- [ ] Threads Needed stat is prominently displayed below Colors Used slider
- [ ] Blueprint output canvas takes up ≥70% of viewport height on desktop
- [ ] Reference image is ≤25% width on desktop and collapsed by default on mobile
- [ ] Thread list is full-width and feels like the primary deliverable

### Visual Prominence
- [ ] Colors Used slider is visually larger/more prominent than other controls
- [ ] Thread list items have larger swatches (≥20x20px) and readable text
- [ ] DMC codes and names are easily scannable (font size ≥14px)
- [ ] Percentages are clearly visible and aligned

### Functionality
- [ ] All existing functionality preserved (no regressions)
- [ ] Advanced Options collapsed by default
- [ ] Reference image collapsible and collapsed on mobile by default
- [ ] Thread list percentages sum to 100%
- [ ] Copy Thread List button works correctly

### Responsive Design
- [ ] Mobile layout stacks vertically with proper spacing
- [ ] Desktop layout uses grid with proper column ratios
- [ ] All controls accessible and usable on mobile
- [ ] Canvas scales appropriately on all screen sizes

### User Experience
- [ ] Primary workflow: Upload → Adjust Colors Used → View Blueprint → Read Thread List
- [ ] Advanced options don't interfere with primary workflow
- [ ] Reference image doesn't compete with blueprint output for attention
- [ ] Thread list feels like the final deliverable (printable, shareable)

---

## Implementation Notes

- **No server changes**: All changes are UI-only (components, layout, styling)
- **No new dependencies**: Use existing Tailwind CSS and React patterns
- **No ThreeJS refactoring**: Keep BlueprintCanvas component as-is
- **Preserve state management**: Keep existing Zustand store structure
- **Maintain accessibility**: Ensure keyboard navigation and screen reader support

---

## Success Metrics

After implementation, the UI should:
1. Make "Colors Used" feel like the primary control
2. Make blueprint output feel like the primary visual
3. Make thread list feel like the primary deliverable
4. Hide complexity (advanced options) without removing functionality
5. Work seamlessly on both desktop and mobile
