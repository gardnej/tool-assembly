/**
 * The Manufacture ribbon, generated from Fusion's own source.
 *
 * Do not edit by hand: `scripts/build-ribbon.py` reads the layout from
 * `TabToolbars.xml`, the captions from the translation map and the C++ that
 * names the panels, and the artwork from the icon resources. Rerun it after a
 * sync rather than patching this file, or the ribbon stops matching the
 * product it is imitating.
 *
 * `promoted` is what the product puts on the bar; `overflow` is the full list
 * behind the panel's chevron. Panels are in the order the product shows them.
 */

export interface RibbonCommand {
  /** Fusion's own command id, e.g. `IronToolLibrary`. */
  id: string;
  label: string;
  /** File name under `src/assets/ribbon-icons`, or null where none was found. */
  icon: string | null;
  /** Present on split buttons, e.g. Manage's Solid Holder. */
  items?: RibbonCommand[];
}

export interface RibbonPanel {
  id: string;
  label: string;
  promoted: RibbonCommand[];
  overflow: RibbonCommand[];
}

export interface RibbonTab {
  id: string;
  label: string;
  panels: RibbonPanel[];
}

export const MANUFACTURE_TABS: RibbonTab[] = [
  {
    "id": "MillingTab",
    "label": "Milling",
    "panels": [
      {
        "id": "CAMJobPanel",
        "label": "Setup",
        "promoted": [
          {
            "id": "CreateSetupCmd",
            "label": "New Setup",
            "icon": "Setup.svg"
          },
          {
            "id": "IronNcProgram",
            "label": "Create NC Program",
            "icon": "NCProgram.png"
          }
        ],
        "overflow": [
          {
            "id": "CreateSetupCmd",
            "label": "New Setup",
            "icon": "Setup.svg"
          },
          {
            "id": "IronNcProgram",
            "label": "Create NC Program",
            "icon": "NCProgram.png"
          },
          {
            "id": "IronFolder",
            "label": "New Folder",
            "icon": "Folder.svg"
          },
          {
            "id": "IronPattern",
            "label": "New Pattern",
            "icon": "linear.svg"
          },
          {
            "id": "IronStrategy_manual",
            "label": "Manual NC",
            "icon": "StrategyManualNC.png"
          },
          {
            "id": "IronStrategy_probe",
            "label": "Probe WCS",
            "icon": "StrategyProbe.svg"
          },
          {
            "id": "CreateSetupGroupCmd",
            "label": "New Setup Group",
            "icon": "Setup.svg"
          },
          {
            "id": "IronStrategy_tool_orientation",
            "label": "Tool Orientation",
            "icon": "ToolOrientation.png"
          },
          {
            "id": "IronImportAllCAMXRefsCmd",
            "label": "Insert Manufacturing Data",
            "icon": "InsertManufacturingData.svg"
          },
          {
            "id": "IronStrategy_debug_cad_objects",
            "label": "Debug Cad Object Parameters",
            "icon": "ToolOrientation.png"
          },
          {
            "id": "MSFWmdCreateAggregationAssetWorkingModelCmd",
            "label": "MSF Wmd Create Aggregation Asset Working Model",
            "icon": null
          }
        ]
      },
      {
        "id": "CAM2DPanel",
        "label": "2D",
        "promoted": [
          {
            "id": "IronStrategy_face",
            "label": "Face",
            "icon": "StrategyFacing.png"
          },
          {
            "id": "IronStrategy_adaptive2d",
            "label": "2D Adaptive Roughing",
            "icon": "StrategyAdaptive2D.png"
          },
          {
            "id": "IronStrategy_contour2d",
            "label": "2D Contour",
            "icon": "StrategyContour2D.png"
          }
        ],
        "overflow": [
          {
            "id": "IronStrategy_featureRecognition",
            "label": "Feature Recognition",
            "icon": null
          },
          {
            "id": "IronStrategy_adaptive2d",
            "label": "2D Adaptive Roughing",
            "icon": "StrategyAdaptive2D.png"
          },
          {
            "id": "IronStrategy_pocket2d",
            "label": "2D Offset Roughing (Pocket)",
            "icon": "StrategyPocket2D.png"
          },
          {
            "id": "IronStrategy_face",
            "label": "Face",
            "icon": "StrategyFacing.png"
          },
          {
            "id": "IronStrategy_contour2d",
            "label": "2D Contour",
            "icon": "StrategyContour2D.png"
          },
          {
            "id": "IronStrategy_slot",
            "label": "Slot",
            "icon": "StrategySlot.png"
          },
          {
            "id": "IronStrategy_path3d",
            "label": "Trace",
            "icon": "StrategyPath3D.png"
          },
          {
            "id": "IronStrategy_thread",
            "label": "Thread",
            "icon": "StrategyThread.png"
          },
          {
            "id": "IronStrategy_bore",
            "label": "Bore",
            "icon": "StrategyBore.png"
          },
          {
            "id": "IronStrategy_circular",
            "label": "Circular",
            "icon": "StrategyCircular.png"
          },
          {
            "id": "IronStrategy_engrave",
            "label": "Engrave",
            "icon": "StrategyEngrave.png"
          },
          {
            "id": "IronStrategy_chamfer2d",
            "label": "2D Chamfer",
            "icon": "StrategyChamfer2D.png"
          }
        ]
      },
      {
        "id": "CAM3DPanel",
        "label": "3D",
        "promoted": [
          {
            "id": "IronStrategy_adaptive",
            "label": "3D Adaptive Roughing",
            "icon": "StrategyAdaptive3D.png"
          },
          {
            "id": "IronStrategy_steep_and_shallow",
            "label": "Steep and Shallow",
            "icon": "StrategySteepAndShallow.png"
          },
          {
            "id": "IronStrategy_flat",
            "label": "Flat",
            "icon": "StrategyFlat.png"
          },
          {
            "id": "IronStrategy_parallel_new",
            "label": "Parallel",
            "icon": "StrategyParallel.png"
          },
          {
            "id": "IronStrategy_scallop_new",
            "label": "Scallop",
            "icon": "StrategyScallop.png"
          },
          {
            "id": "IronStrategy_contour_new",
            "label": "3D Contour",
            "icon": "StrategyContour3D.png"
          }
        ],
        "overflow": [
          {
            "id": "IronStrategy_adaptive",
            "label": "3D Adaptive Roughing",
            "icon": "StrategyAdaptive3D.png"
          },
          {
            "id": "IronStrategy_pocket_new",
            "label": "3D Offset Roughing (Pocket)",
            "icon": "StrategyPocket3D.png"
          },
          {
            "id": "IronStrategy_moduleworks_three_plus_two",
            "label": "3+2 Roughing",
            "icon": "StrategyAutomaticThreePlusTwoRoughing.svg"
          },
          {
            "id": "IronStrategy_model_area_clearance",
            "label": "Model Area Clearance",
            "icon": "StrategyFlat.png"
          },
          {
            "id": "IronStrategy_steep_and_shallow",
            "label": "Steep and Shallow",
            "icon": "StrategySteepAndShallow.png"
          },
          {
            "id": "IronStrategy_flat",
            "label": "Flat",
            "icon": "StrategyFlat.png"
          },
          {
            "id": "IronStrategy_inclined_walls",
            "label": "Wall",
            "icon": "StrategyInclinedWalls.png"
          },
          {
            "id": "IronStrategy_parallel_new",
            "label": "Parallel",
            "icon": "StrategyParallel.png"
          },
          {
            "id": "IronStrategy_scallop_new",
            "label": "Scallop",
            "icon": "StrategyScallop.png"
          },
          {
            "id": "IronStrategy_contour_new",
            "label": "3D Contour",
            "icon": "StrategyContour3D.png"
          },
          {
            "id": "IronStrategy_ramp",
            "label": "Ramp",
            "icon": "StrategyRamp.png"
          },
          {
            "id": "IronStrategy_pencil_new",
            "label": "Pencil",
            "icon": "StrategyPencil.png"
          },
          {
            "id": "IronStrategy_horizontal_new",
            "label": "Horizontal",
            "icon": "StrategyHorizontal.png"
          },
          {
            "id": "IronStrategy_spiral_new",
            "label": "Spiral",
            "icon": "StrategySpiral.png"
          },
          {
            "id": "IronStrategy_radial_new",
            "label": "Radial",
            "icon": "StrategyRadial.png"
          },
          {
            "id": "IronStrategy_morphed_spiral",
            "label": "Morphed Spiral",
            "icon": "StrategyMorphedSpiral.png"
          },
          {
            "id": "IronStrategy_project",
            "label": "Project",
            "icon": "StrategyProject.png"
          },
          {
            "id": "IronStrategy_blend",
            "label": "Blend",
            "icon": "StrategyBlend.svg"
          },
          {
            "id": "IronStrategy_morph",
            "label": "Morph",
            "icon": "StrategyMorph.png"
          },
          {
            "id": "IronStrategy_rest_finishing",
            "label": "Corner",
            "icon": "StrategyRestFinishing.png"
          },
          {
            "id": "IronStrategy_flow",
            "label": "Flow (Old)",
            "icon": "StrategyFlow.png"
          },
          {
            "id": "IronStrategy_flow2",
            "label": "Flow",
            "icon": "StrategyFlow.png"
          },
          {
            "id": "IronStrategy_chamfer",
            "label": "3D Chamfer",
            "icon": "StrategyChamfer2D.png"
          },
          {
            "id": "IronStrategy_moduleworks_automatic_deburring",
            "label": "Deburr",
            "icon": "StrategyAutomaticDeburring.svg"
          },
          {
            "id": "IronStrategy_moduleworks_geodesic",
            "label": "Geodesic",
            "icon": "StrategyGeodesic.svg"
          }
        ]
      },
      {
        "id": "CAMDrillingPanel",
        "label": "Drilling",
        "promoted": [
          {
            "id": "IronStrategy_drill",
            "label": "Drill",
            "icon": "StrategyDrill.svg"
          },
          {
            "id": "IronHoleRecognition",
            "label": "Hole Recognition",
            "icon": "HoleRecognition.png"
          },
          {
            "id": "IronHoleManager",
            "label": "Hole Manager",
            "icon": "HoleManager.svg"
          },
          {
            "id": "IronMachineHoles",
            "label": "Machine Holes",
            "icon": "MachineHoles.svg"
          }
        ],
        "overflow": [
          {
            "id": "IronStrategy_drill",
            "label": "Drill",
            "icon": "StrategyDrill.svg"
          },
          {
            "id": "IronHoleRecognition",
            "label": "Hole Recognition",
            "icon": "HoleRecognition.png"
          },
          {
            "id": "IronHoleManager",
            "label": "Hole Manager",
            "icon": "HoleManager.svg"
          },
          {
            "id": "IronMachineHoles",
            "label": "Machine Holes",
            "icon": "MachineHoles.svg"
          }
        ]
      },
      {
        "id": "CAMMultiAxisPanel",
        "label": "Multi-Axis",
        "promoted": [
          {
            "id": "IronStrategy_swarf5d",
            "label": "Swarf",
            "icon": "StrategySwarf.png"
          },
          {
            "id": "IronStrategy_moduleworks_4axis_roughing",
            "label": "Rotary Offset Roughing (Pocket)",
            "icon": "StrategyRotaryPocket.svg"
          }
        ],
        "overflow": [
          {
            "id": "IronStrategy_moduleworks_4axis_roughing",
            "label": "Rotary Offset Roughing (Pocket)",
            "icon": "StrategyRotaryPocket.svg"
          },
          {
            "id": "IronStrategy_moduleworks_multiaxis_roughing",
            "label": "Multi-Axis Roughing",
            "icon": "StrategyMultiAxisClearing.svg"
          },
          {
            "id": "IronStrategy_swarf5d",
            "label": "Swarf",
            "icon": "StrategySwarf.png"
          },
          {
            "id": "IronStrategy_moduleworks_swarf",
            "label": "Advanced Swarf",
            "icon": "StrategyAdvancedSwarf.svg"
          },
          {
            "id": "IronStrategy_multiAxisContour",
            "label": "Multi-Axis Contour",
            "icon": "StrategyMAContour.png"
          },
          {
            "id": "IronStrategy_rotary_finishing",
            "label": "Rotary Parallel",
            "icon": "StrategyRotaryFinishing.png"
          },
          {
            "id": "IronStrategy_moduleworks_4axis_finishing",
            "label": "Rotary Contour",
            "icon": "StrategyRotaryContour.svg"
          },
          {
            "id": "IronStrategy_moduleworks_multiaxis_finishing",
            "label": "Multi-Axis Finishing",
            "icon": "StrategyMultiAxisFinishing.svg"
          }
        ]
      },
      {
        "id": "CAMAutomatePanel",
        "label": "Automate",
        "promoted": [
          {
            "id": "IronAutomatedCAM",
            "label": "Automated CAM",
            "icon": "AutomatedCAM.svg"
          }
        ],
        "overflow": [
          {
            "id": "IronAutomatedCAM",
            "label": "Automated CAM",
            "icon": "AutomatedCAM.svg"
          }
        ]
      },
      {
        "id": "CAMEditPanel",
        "label": "Modify",
        "promoted": [
          {
            "id": "IronToolpathTrim",
            "label": "Trim",
            "icon": "EditTrim.png"
          },
          {
            "id": "IronToolpathEditDelete",
            "label": "Delete Passes",
            "icon": "EditDelete.png"
          },
          {
            "id": "IronToolpathEditLeadsLinks",
            "label": "Leads and Links",
            "icon": "EditLeadsLinks.svg"
          },
          {
            "id": "IronToolpathEditToolChange",
            "label": "Replace Tool",
            "icon": "EditToolChange.svg"
          },
          {
            "id": "IronToolpathEditMoveStartPoints",
            "label": "Move Entry Positions",
            "icon": "EditMoveStartPoints.png"
          },
          {
            "id": "IronToolpathEditFeedrate",
            "label": "Feedrate",
            "icon": "EditFeedrate.svg"
          }
        ],
        "overflow": [
          {
            "id": "IronToolpathTrim",
            "label": "Trim",
            "icon": "EditTrim.png"
          },
          {
            "id": "IronToolpathEditDelete",
            "label": "Delete Passes",
            "icon": "EditDelete.png"
          },
          {
            "id": "IronToolpathEditLeadsLinks",
            "label": "Leads and Links",
            "icon": "EditLeadsLinks.svg"
          },
          {
            "id": "IronToolpathEditToolChange",
            "label": "Replace Tool",
            "icon": "EditToolChange.svg"
          },
          {
            "id": "IronToolpathEditMoveStartPoints",
            "label": "Move Entry Positions",
            "icon": "EditMoveStartPoints.png"
          },
          {
            "id": "IronToolpathEditFeedrate",
            "label": "Feedrate",
            "icon": "EditFeedrate.svg"
          }
        ]
      },
      {
        "id": "CAMActionPanel",
        "label": "Actions",
        "promoted": [
          {
            "id": "IronMachineSimulation",
            "label": "Simulate with Machine",
            "icon": "MachineSimulation.png"
          },
          {
            "id": "IronPostProcess",
            "label": "Post Process",
            "icon": "PostProcess.png"
          },
          {
            "id": "IronSetupSheetSwitchboard",
            "label": "Setup Sheet",
            "icon": "SetupSheet.png"
          }
        ],
        "overflow": [
          {
            "id": "IronGenerateToolpath",
            "label": "Generate",
            "icon": "Regenerate.png"
          },
          {
            "id": "IronSimulation",
            "label": "Simulate",
            "icon": "Simulation.png"
          },
          {
            "id": "IronMachineSimulation",
            "label": "Simulate with Machine",
            "icon": "MachineSimulation.png"
          },
          {
            "id": "IronPostProcess",
            "label": "Post Process",
            "icon": "PostProcess.png"
          },
          {
            "id": "IronSetupSheetSwitchboard",
            "label": "Setup Sheet",
            "icon": "SetupSheet.png"
          },
          {
            "id": "IronMachiningTime",
            "label": "Machining Time",
            "icon": "MachiningTime.png"
          }
        ]
      },
      {
        "id": "CAMManagePanel",
        "label": "Manage",
        "promoted": [
          {
            "id": "IronToolLibrary",
            "label": "Tool Library",
            "icon": "ToolLibrary.png"
          },
          {
            "id": "IronStockMaterialLibrary",
            "label": "Stock Materials Library",
            "icon": "StockMaterialLibrary.png"
          },
          {
            "id": "IronMachineLibrary",
            "label": "Machine Library",
            "icon": "MachineLibrary.png"
          },
          {
            "id": "IronPostLibrary",
            "label": "Post Library",
            "icon": "PostLibrary.svg"
          },
          {
            "id": "IronTemplateLibrary",
            "label": "Template Library",
            "icon": "TemplateLibrary.svg"
          }
        ],
        "overflow": [
          {
            "id": "IronStrategy_create_form_mill",
            "label": "Form Mill",
            "icon": null
          },
          {
            "id": "IronSolidHolder",
            "label": "Solid Holder",
            "icon": null,
            "items": [
              {
                "id": "IronTurningToolHolder",
                "label": "Turning Tool Holder",
                "icon": "TurningToolHolder.svg"
              },
              {
                "id": "IronToolBlock",
                "label": "Tool Block",
                "icon": "ToolBlock.svg"
              },
              {
                "id": "IronToolAssembly",
                "label": "Tool Assembly",
                "icon": null
              },
              {
                "id": "IronStrategy_SolidHolderMilling",
                "label": "Milling Tool Holder",
                "icon": null
              }
            ]
          },
          {
            "id": "IronToolLibrary",
            "label": "Tool Library",
            "icon": "ToolLibrary.png"
          },
          {
            "id": "IronStockMaterialLibrary",
            "label": "Stock Materials Library",
            "icon": "StockMaterialLibrary.png"
          },
          {
            "id": "IronMachineLibrary",
            "label": "Machine Library",
            "icon": "MachineLibrary.png"
          },
          {
            "id": "IronPostLibrary",
            "label": "Post Library",
            "icon": "PostLibrary.svg"
          },
          {
            "id": "IronTemplateLibrary",
            "label": "Template Library",
            "icon": "TemplateLibrary.svg"
          },
          {
            "id": "IronSetupSheetConfigurations",
            "label": "Setup Sheet Configurations",
            "icon": "SetupSheetConfigurations.png"
          },
          {
            "id": "IronTaskManager",
            "label": "Task Manager",
            "icon": "TaskManager.png"
          },
          {
            "id": "IronExportDefaults",
            "label": "Export Defaults",
            "icon": "ExportDefaults.svg"
          },
          {
            "id": "IronImportDefaults",
            "label": "Import Defaults",
            "icon": "ImportDefaults.png"
          },
          {
            "id": "IronResetDefaults",
            "label": "Reset Defaults",
            "icon": "ResetDefaults.png"
          },
          {
            "id": "IronShowTemplateSelector",
            "label": "Show Template Selector",
            "icon": null
          },
          {
            "id": "IronTranslation",
            "label": "Translation",
            "icon": "Translation.png"
          },
          {
            "id": "IronStrategy_debug_cad_objects",
            "label": "Debug Cad Object Parameters",
            "icon": "ToolOrientation.png"
          }
        ]
      },
      {
        "id": "CAMInspectPanel",
        "label": "Inspect",
        "promoted": [
          {
            "id": "MeasureCommand",
            "label": "Measure",
            "icon": "Measure.png"
          }
        ],
        "overflow": [
          {
            "id": "MeasureCommand",
            "label": "Measure",
            "icon": "Measure.png"
          },
          {
            "id": "FusionHalfSectionViewCommand",
            "label": "FusionHalfSectionView",
            "icon": null
          },
          {
            "id": "InterferenceCheckCommand",
            "label": "InterferenceCheck",
            "icon": null
          },
          {
            "id": "FusionCurvatureCombAnalysisCommand",
            "label": "FusionCurvatureCombAnalysis",
            "icon": null
          },
          {
            "id": "FusionCurvatureMapAnalysisCommand",
            "label": "FusionCurvatureMapAnalysis",
            "icon": null
          },
          {
            "id": "FusionDraftAnalysisCommand",
            "label": "FusionDraftAnalysis",
            "icon": null
          },
          {
            "id": "FusionIsoCurveAnalysisCommand",
            "label": "FusionIsoCurveAnalysis",
            "icon": null
          },
          {
            "id": "FusionZebraAnalysisCommand",
            "label": "FusionZebraAnalysis",
            "icon": null
          },
          {
            "id": "FusionAccessibilityAnalysisCommand",
            "label": "FusionAccessibilityAnalysis",
            "icon": null
          },
          {
            "id": "FusionMinimumRadiusAnalysisCommand",
            "label": "FusionMinimumRadiusAnalysis",
            "icon": null
          }
        ]
      },
      {
        "id": "SelectPanel",
        "label": "Select",
        "promoted": [
          {
            "id": "SelectCommand",
            "label": "Select",
            "icon": null
          }
        ],
        "overflow": [
          {
            "id": "SelectCommand",
            "label": "Select",
            "icon": null
          },
          {
            "id": "selectWindow",
            "label": "Window Selection",
            "icon": null
          },
          {
            "id": "selectFreeForm",
            "label": "Freeform Selection",
            "icon": null
          },
          {
            "id": "selectPaint",
            "label": "Paint Selection",
            "icon": null
          },
          {
            "id": "AdvancedDirectSelectionIronParam",
            "label": "Selection Bar",
            "icon": null
          },
          {
            "id": "SelectionTools",
            "label": "Selection Tools",
            "icon": null,
            "items": [
              {
                "id": "SelectByNameCommand",
                "label": "SimSelectByNameCommand",
                "icon": null
              },
              {
                "id": "SelectByBoundaryCommand",
                "label": "Select By Boundary",
                "icon": null
              },
              {
                "id": "FusionSelectBodiesBySizeCommand",
                "label": "SelectBodiesBySize",
                "icon": null
              }
            ]
          },
          {
            "id": "SelectionPriorityCommands",
            "label": "Selection Priority Commands",
            "icon": null,
            "items": [
              {
                "id": "SelectBodyPriorityCommand",
                "label": "Select Body Priority",
                "icon": null
              },
              {
                "id": "SelectFacePriorityCommand",
                "label": "Select Face Priority",
                "icon": null
              },
              {
                "id": "SelectEdgePriorityCommand",
                "label": "Select Edge Priority",
                "icon": null
              },
              {
                "id": "SelectComponentPriorityCommand",
                "label": "Select Component Priority",
                "icon": null
              }
            ]
          },
          {
            "id": "SelectionFilterCommand",
            "label": "Selection Filters",
            "icon": null,
            "items": []
          }
        ]
      }
    ]
  },
  {
    "id": "TurningTab",
    "label": "Turning",
    "panels": [
      {
        "id": "CAMJobPanel",
        "label": "Setup",
        "promoted": [
          {
            "id": "CreateSetupCmd",
            "label": "New Setup",
            "icon": "Setup.svg"
          },
          {
            "id": "IronNcProgram",
            "label": "Create NC Program",
            "icon": "NCProgram.png"
          }
        ],
        "overflow": [
          {
            "id": "CreateSetupCmd",
            "label": "New Setup",
            "icon": "Setup.svg"
          },
          {
            "id": "IronNcProgram",
            "label": "Create NC Program",
            "icon": "NCProgram.png"
          },
          {
            "id": "IronFolder",
            "label": "New Folder",
            "icon": "Folder.svg"
          },
          {
            "id": "IronPattern",
            "label": "New Pattern",
            "icon": "linear.svg"
          },
          {
            "id": "IronStrategy_manual",
            "label": "Manual NC",
            "icon": "StrategyManualNC.png"
          },
          {
            "id": "IronStrategy_probe",
            "label": "Probe WCS",
            "icon": "StrategyProbe.svg"
          },
          {
            "id": "CreateSetupGroupCmd",
            "label": "New Setup Group",
            "icon": "Setup.svg"
          },
          {
            "id": "IronStrategy_tool_orientation",
            "label": "Tool Orientation",
            "icon": "ToolOrientation.png"
          },
          {
            "id": "IronImportAllCAMXRefsCmd",
            "label": "Insert Manufacturing Data",
            "icon": "InsertManufacturingData.svg"
          },
          {
            "id": "IronStrategy_debug_cad_objects",
            "label": "Debug Cad Object Parameters",
            "icon": "ToolOrientation.png"
          },
          {
            "id": "MSFWmdCreateAggregationAssetWorkingModelCmd",
            "label": "MSF Wmd Create Aggregation Asset Working Model",
            "icon": null
          }
        ]
      },
      {
        "id": "CAMTurningPanel",
        "label": "Turning",
        "promoted": [
          {
            "id": "IronStrategy_turningFace",
            "label": "Turning Face",
            "icon": "StrategyTurningFace.png"
          },
          {
            "id": "IronStrategy_turningRoughing",
            "label": "Turning Profile",
            "icon": "StrategyTurningProfile.png"
          },
          {
            "id": "IronStrategy_turningProfileRoughing",
            "label": "Turning Profile Roughing",
            "icon": "StrategyTurningProfileRoughing.png"
          },
          {
            "id": "IronStrategy_turningProfileFinishing",
            "label": "Turning Profile Finishing",
            "icon": "StrategyTurningProfileFinishing.png"
          },
          {
            "id": "IronStrategy_turningProfileGroove",
            "label": "Turning Groove",
            "icon": "StrategyTurningProfileGroove.png"
          },
          {
            "id": "IronStrategy_turningPart",
            "label": "Turning Part",
            "icon": "StrategyTurningPart.png"
          }
        ],
        "overflow": [
          {
            "id": "IronStrategy_turningFace",
            "label": "Turning Face",
            "icon": "StrategyTurningFace.png"
          },
          {
            "id": "IronStrategy_turningProfileRoughing",
            "label": "Turning Profile Roughing",
            "icon": "StrategyTurningProfileRoughing.png"
          },
          {
            "id": "IronStrategy_turningProfileFinishing",
            "label": "Turning Profile Finishing",
            "icon": "StrategyTurningProfileFinishing.png"
          },
          {
            "id": "IronStrategy_turningGrooveRoughing",
            "label": "Turning Groove Roughing",
            "icon": "StrategyTurningGrooveRoughing.png"
          },
          {
            "id": "IronStrategy_turningGrooveFinishing",
            "label": "Turning Groove Finishing",
            "icon": "StrategyTurningGrooveFinishing.png"
          },
          {
            "id": "IronStrategy_turningRoughing",
            "label": "Turning Profile",
            "icon": "StrategyTurningProfile.png"
          },
          {
            "id": "IronStrategy_turningAdaptiveRoughing",
            "label": "Turning Adaptive Roughing",
            "icon": "StrategyTurningAdaptiveRoughing.png"
          },
          {
            "id": "IronStrategy_turningProfileGroove",
            "label": "Turning Groove",
            "icon": "StrategyTurningProfileGroove.png"
          },
          {
            "id": "IronStrategy_turningGroove",
            "label": "Turning Single Groove",
            "icon": "StrategyTurningGroove.png"
          },
          {
            "id": "IronStrategy_turningThread",
            "label": "Turning Thread",
            "icon": "StrategyTurningThread.png"
          },
          {
            "id": "IronStrategy_turningChamfer",
            "label": "Turning Chamfer",
            "icon": "StrategyTurningChamfer.png"
          },
          {
            "id": "IronStrategy_turningPart",
            "label": "Turning Part",
            "icon": "StrategyTurningPart.png"
          },
          {
            "id": "IronStrategy_turningTrace",
            "label": "Turning Trace",
            "icon": "StrategyTurningTrace.svg"
          }
        ]
      },
      {
        "id": "CAMPartHandlingPanel",
        "label": "Part Handling",
        "promoted": [
          {
            "id": "IronStrategy_turningSecondarySpindleGrab",
            "label": "Subspindle Grab",
            "icon": "StrategyTurningSecondarySpindleGrab.png"
          },
          {
            "id": "IronStrategy_turningSecondarySpindlePull",
            "label": "Bar Pull",
            "icon": "StrategyTurningSecondarySpindlePull.png"
          },
          {
            "id": "IronStrategy_turningSecondarySpindleReturn",
            "label": "Subspindle Return",
            "icon": "StrategyTurningSecondarySpindleReturn.png"
          },
          {
            "id": "IronStrategy_turningToolCall",
            "label": "Tool Call",
            "icon": "StrategyTurningToolCall.svg"
          }
        ],
        "overflow": [
          {
            "id": "IronStrategy_turningSecondarySpindleGrab",
            "label": "Subspindle Grab",
            "icon": "StrategyTurningSecondarySpindleGrab.png"
          },
          {
            "id": "IronStrategy_turningSecondarySpindlePull",
            "label": "Bar Pull",
            "icon": "StrategyTurningSecondarySpindlePull.png"
          },
          {
            "id": "IronStrategy_turningSecondarySpindleReturn",
            "label": "Subspindle Return",
            "icon": "StrategyTurningSecondarySpindleReturn.png"
          },
          {
            "id": "IronStrategy_turningToolCall",
            "label": "Tool Call",
            "icon": "StrategyTurningToolCall.svg"
          }
        ]
      },
      {
        "id": "CAMDrillingPanel",
        "label": "Drilling",
        "promoted": [
          {
            "id": "IronStrategy_drill",
            "label": "Drill",
            "icon": "StrategyDrill.svg"
          },
          {
            "id": "IronHoleRecognition",
            "label": "Hole Recognition",
            "icon": "HoleRecognition.png"
          },
          {
            "id": "IronHoleManager",
            "label": "Hole Manager",
            "icon": "HoleManager.svg"
          },
          {
            "id": "IronMachineHoles",
            "label": "Machine Holes",
            "icon": "MachineHoles.svg"
          }
        ],
        "overflow": [
          {
            "id": "IronStrategy_drill",
            "label": "Drill",
            "icon": "StrategyDrill.svg"
          },
          {
            "id": "IronHoleRecognition",
            "label": "Hole Recognition",
            "icon": "HoleRecognition.png"
          },
          {
            "id": "IronHoleManager",
            "label": "Hole Manager",
            "icon": "HoleManager.svg"
          },
          {
            "id": "IronMachineHoles",
            "label": "Machine Holes",
            "icon": "MachineHoles.svg"
          }
        ]
      },
      {
        "id": "CAMTurningEditPanel",
        "label": "Modify",
        "promoted": [
          {
            "id": "IronToolpathTrim",
            "label": "Trim",
            "icon": "EditTrim.png"
          },
          {
            "id": "IronToolpathEditDelete",
            "label": "Delete Passes",
            "icon": "EditDelete.png"
          },
          {
            "id": "IronToolpathEditFeedrate",
            "label": "Feedrate",
            "icon": "EditFeedrate.svg"
          }
        ],
        "overflow": [
          {
            "id": "IronToolpathTrim",
            "label": "Trim",
            "icon": "EditTrim.png"
          },
          {
            "id": "IronToolpathEditDelete",
            "label": "Delete Passes",
            "icon": "EditDelete.png"
          },
          {
            "id": "IronToolpathEditFeedrate",
            "label": "Feedrate",
            "icon": "EditFeedrate.svg"
          }
        ]
      },
      {
        "id": "CAMActionPanel",
        "label": "Actions",
        "promoted": [
          {
            "id": "IronMachineSimulation",
            "label": "Simulate with Machine",
            "icon": "MachineSimulation.png"
          },
          {
            "id": "IronPostProcess",
            "label": "Post Process",
            "icon": "PostProcess.png"
          },
          {
            "id": "IronSetupSheetSwitchboard",
            "label": "Setup Sheet",
            "icon": "SetupSheet.png"
          }
        ],
        "overflow": [
          {
            "id": "IronGenerateToolpath",
            "label": "Generate",
            "icon": "Regenerate.png"
          },
          {
            "id": "IronSimulation",
            "label": "Simulate",
            "icon": "Simulation.png"
          },
          {
            "id": "IronMachineSimulation",
            "label": "Simulate with Machine",
            "icon": "MachineSimulation.png"
          },
          {
            "id": "IronPostProcess",
            "label": "Post Process",
            "icon": "PostProcess.png"
          },
          {
            "id": "IronSetupSheetSwitchboard",
            "label": "Setup Sheet",
            "icon": "SetupSheet.png"
          },
          {
            "id": "IronMachiningTime",
            "label": "Machining Time",
            "icon": "MachiningTime.png"
          }
        ]
      },
      {
        "id": "CAMManagePanel",
        "label": "Manage",
        "promoted": [
          {
            "id": "IronToolLibrary",
            "label": "Tool Library",
            "icon": "ToolLibrary.png"
          },
          {
            "id": "IronStockMaterialLibrary",
            "label": "Stock Materials Library",
            "icon": "StockMaterialLibrary.png"
          },
          {
            "id": "IronMachineLibrary",
            "label": "Machine Library",
            "icon": "MachineLibrary.png"
          },
          {
            "id": "IronPostLibrary",
            "label": "Post Library",
            "icon": "PostLibrary.svg"
          },
          {
            "id": "IronTemplateLibrary",
            "label": "Template Library",
            "icon": "TemplateLibrary.svg"
          }
        ],
        "overflow": [
          {
            "id": "IronStrategy_create_form_mill",
            "label": "Form Mill",
            "icon": null
          },
          {
            "id": "IronSolidHolder",
            "label": "Solid Holder",
            "icon": null,
            "items": [
              {
                "id": "IronTurningToolHolder",
                "label": "Turning Tool Holder",
                "icon": "TurningToolHolder.svg"
              },
              {
                "id": "IronToolBlock",
                "label": "Tool Block",
                "icon": "ToolBlock.svg"
              },
              {
                "id": "IronToolAssembly",
                "label": "Tool Assembly",
                "icon": null
              },
              {
                "id": "IronStrategy_SolidHolderMilling",
                "label": "Milling Tool Holder",
                "icon": null
              }
            ]
          },
          {
            "id": "IronToolLibrary",
            "label": "Tool Library",
            "icon": "ToolLibrary.png"
          },
          {
            "id": "IronStockMaterialLibrary",
            "label": "Stock Materials Library",
            "icon": "StockMaterialLibrary.png"
          },
          {
            "id": "IronMachineLibrary",
            "label": "Machine Library",
            "icon": "MachineLibrary.png"
          },
          {
            "id": "IronPostLibrary",
            "label": "Post Library",
            "icon": "PostLibrary.svg"
          },
          {
            "id": "IronTemplateLibrary",
            "label": "Template Library",
            "icon": "TemplateLibrary.svg"
          },
          {
            "id": "IronSetupSheetConfigurations",
            "label": "Setup Sheet Configurations",
            "icon": "SetupSheetConfigurations.png"
          },
          {
            "id": "IronTaskManager",
            "label": "Task Manager",
            "icon": "TaskManager.png"
          },
          {
            "id": "IronExportDefaults",
            "label": "Export Defaults",
            "icon": "ExportDefaults.svg"
          },
          {
            "id": "IronImportDefaults",
            "label": "Import Defaults",
            "icon": "ImportDefaults.png"
          },
          {
            "id": "IronResetDefaults",
            "label": "Reset Defaults",
            "icon": "ResetDefaults.png"
          },
          {
            "id": "IronShowTemplateSelector",
            "label": "Show Template Selector",
            "icon": null
          },
          {
            "id": "IronTranslation",
            "label": "Translation",
            "icon": "Translation.png"
          },
          {
            "id": "IronStrategy_debug_cad_objects",
            "label": "Debug Cad Object Parameters",
            "icon": "ToolOrientation.png"
          }
        ]
      },
      {
        "id": "CAMInspectPanel",
        "label": "Inspect",
        "promoted": [
          {
            "id": "MeasureCommand",
            "label": "Measure",
            "icon": "Measure.png"
          }
        ],
        "overflow": [
          {
            "id": "MeasureCommand",
            "label": "Measure",
            "icon": "Measure.png"
          },
          {
            "id": "FusionHalfSectionViewCommand",
            "label": "FusionHalfSectionView",
            "icon": null
          },
          {
            "id": "InterferenceCheckCommand",
            "label": "InterferenceCheck",
            "icon": null
          },
          {
            "id": "FusionCurvatureCombAnalysisCommand",
            "label": "FusionCurvatureCombAnalysis",
            "icon": null
          },
          {
            "id": "FusionCurvatureMapAnalysisCommand",
            "label": "FusionCurvatureMapAnalysis",
            "icon": null
          },
          {
            "id": "FusionDraftAnalysisCommand",
            "label": "FusionDraftAnalysis",
            "icon": null
          },
          {
            "id": "FusionIsoCurveAnalysisCommand",
            "label": "FusionIsoCurveAnalysis",
            "icon": null
          },
          {
            "id": "FusionZebraAnalysisCommand",
            "label": "FusionZebraAnalysis",
            "icon": null
          },
          {
            "id": "FusionAccessibilityAnalysisCommand",
            "label": "FusionAccessibilityAnalysis",
            "icon": null
          },
          {
            "id": "FusionMinimumRadiusAnalysisCommand",
            "label": "FusionMinimumRadiusAnalysis",
            "icon": null
          }
        ]
      },
      {
        "id": "SelectPanel",
        "label": "Select",
        "promoted": [
          {
            "id": "SelectCommand",
            "label": "Select",
            "icon": null
          }
        ],
        "overflow": [
          {
            "id": "SelectCommand",
            "label": "Select",
            "icon": null
          },
          {
            "id": "selectWindow",
            "label": "Window Selection",
            "icon": null
          },
          {
            "id": "selectFreeForm",
            "label": "Freeform Selection",
            "icon": null
          },
          {
            "id": "selectPaint",
            "label": "Paint Selection",
            "icon": null
          },
          {
            "id": "AdvancedDirectSelectionIronParam",
            "label": "Selection Bar",
            "icon": null
          },
          {
            "id": "SelectionTools",
            "label": "Selection Tools",
            "icon": null,
            "items": [
              {
                "id": "SelectByNameCommand",
                "label": "SimSelectByNameCommand",
                "icon": null
              },
              {
                "id": "SelectByBoundaryCommand",
                "label": "Select By Boundary",
                "icon": null
              },
              {
                "id": "FusionSelectBodiesBySizeCommand",
                "label": "SelectBodiesBySize",
                "icon": null
              }
            ]
          },
          {
            "id": "SelectionPriorityCommands",
            "label": "Selection Priority Commands",
            "icon": null,
            "items": [
              {
                "id": "SelectBodyPriorityCommand",
                "label": "Select Body Priority",
                "icon": null
              },
              {
                "id": "SelectFacePriorityCommand",
                "label": "Select Face Priority",
                "icon": null
              },
              {
                "id": "SelectEdgePriorityCommand",
                "label": "Select Edge Priority",
                "icon": null
              },
              {
                "id": "SelectComponentPriorityCommand",
                "label": "Select Component Priority",
                "icon": null
              }
            ]
          },
          {
            "id": "SelectionFilterCommand",
            "label": "Selection Filters",
            "icon": null,
            "items": []
          }
        ]
      }
    ]
  },
  {
    "id": "AdditiveTab",
    "label": "Additive",
    "panels": [
      {
        "id": "CAMAdditiveJobPanel",
        "label": "Setup",
        "promoted": [
          {
            "id": "CreateSetupCmd",
            "label": "New Setup",
            "icon": "Setup.svg"
          },
          {
            "id": "MSFWmdCreateAggregationAssetWorkingModelCmd",
            "label": "MSF Wmd Create Aggregation Asset Working Model",
            "icon": null
          }
        ],
        "overflow": []
      },
      {
        "id": "CAMAdditivePositioningPanel",
        "label": "Position",
        "promoted": [
          {
            "id": "CAMMoveComponentsCommand",
            "label": "Move Components",
            "icon": "MoveComponent.png"
          },
          {
            "id": "IronMinimizeBoundingBox",
            "label": "Minimize Build Height",
            "icon": "MinimizeBoundingBox.png"
          },
          {
            "id": "IronPlaceOnPlatform",
            "label": "Place on Platform",
            "icon": "PlaceOnPlatform.svg"
          },
          {
            "id": "IronStrategy_additive_arrange_strategy",
            "label": "Arrange",
            "icon": "Arrangement.png"
          },
          {
            "id": "IronStrategy_additive_interference_analysis",
            "label": "Interference Analysis",
            "icon": "InterferenceAnalysis.png"
          }
        ],
        "overflow": []
      },
      {
        "id": "CAMAdditiveModifyPanel",
        "label": "Modify",
        "promoted": [
          {
            "id": "FillPlatformCmd",
            "label": "Fill Build Volume",
            "icon": "FillPlatform.png"
          },
          {
            "id": "LinearArrangeCmd",
            "label": "Duplicate",
            "icon": "Duplicate.svg"
          },
          {
            "id": "IronAssignBuildStrategy",
            "label": "Assign Body Presets",
            "icon": "AssignBuildStrategies.svg"
          }
        ],
        "overflow": []
      },
      {
        "id": "CAMSupportsPanel",
        "label": "Supports",
        "promoted": [
          {
            "id": "IronStrategy_areavolume_additive_support",
            "label": "Volume Support",
            "icon": "AreaVolume.png"
          },
          {
            "id": "IronStrategy_areavolume_additive_fff_support",
            "label": "Solid Volume Support",
            "icon": "AreaVolume.png"
          },
          {
            "id": "IronStrategy_areabar_additive_support",
            "label": "Bar Support",
            "icon": "AreaBar.png"
          },
          {
            "id": "IronStrategy_areabar_additive_fff_support",
            "label": "Solid Bar Support",
            "icon": "AreaBar.png"
          }
        ],
        "overflow": []
      },
      {
        "id": "CAMDEDPanel",
        "label": "Multi-Axis",
        "promoted": [
          {
            "id": "IronStrategy_feature_construction",
            "label": "Feature Construction",
            "icon": "DED.png"
          }
        ],
        "overflow": []
      },
      {
        "id": "CAMAdditiveEditPanel",
        "label": "Modify",
        "promoted": [
          {
            "id": "IronToolpathTrim",
            "label": "Trim",
            "icon": "EditTrim.png"
          },
          {
            "id": "IronToolpathEditDelete",
            "label": "Delete Passes",
            "icon": "EditDelete.png"
          },
          {
            "id": "IronToolpathEditMoveStartPoints",
            "label": "Move Entry Positions",
            "icon": "EditMoveStartPoints.png"
          },
          {
            "id": "IronToolpathEditFeedrate",
            "label": "Feedrate",
            "icon": "EditFeedrate.svg"
          }
        ],
        "overflow": []
      },
      {
        "id": "CAMAdditiveProcessSimPanel",
        "label": "Process Simulation",
        "promoted": [
          {
            "id": "IronStrategy_AdditiveProcessSimulation",
            "label": "Study",
            "icon": "StudyNew.png"
          },
          {
            "id": "IronAdditiveProcessSimPreCheck",
            "label": "PreCheck",
            "icon": "Success.svg"
          },
          {
            "id": "IronAdditiveProcessSimSolve",
            "label": "Solve",
            "icon": "Solve.svg"
          }
        ],
        "overflow": []
      },
      {
        "id": "CAMAdditiveActionPanel",
        "label": "Actions",
        "promoted": [
          {
            "id": "IronGenerateToolpath",
            "label": "Generate",
            "icon": "Regenerate.png"
          },
          {
            "id": "IronSimulation",
            "label": "Simulate",
            "icon": "Simulation.png"
          },
          {
            "id": "IronAdditiveSimulation",
            "label": "Simulate Additive Toolpath",
            "icon": "Simulation.png"
          },
          {
            "id": "IronPostProcess",
            "label": "Post Process",
            "icon": "PostProcess.png"
          },
          {
            "id": "IronStrategy_additive_exportstrategy",
            "label": "Create Machine Build File",
            "icon": "ExportDefaults.svg"
          },
          {
            "id": "IronStrategy_additive_formlabs_exportstrategy",
            "label": "Create Machine Build File",
            "icon": "ExportDefaults.svg"
          }
        ],
        "overflow": []
      },
      {
        "id": "CAMAdditiveManagePanel",
        "label": "Manage",
        "promoted": [
          {
            "id": "IronPrintSettingLibrary",
            "label": "Print Setting Library",
            "icon": "printsettinglibrary.png"
          },
          {
            "id": "IronToolLibrary",
            "label": "Tool Library",
            "icon": "ToolLibrary.png"
          },
          {
            "id": "IronStockMaterialLibrary",
            "label": "Stock Materials Library",
            "icon": "StockMaterialLibrary.png"
          },
          {
            "id": "IronMachineLibrary",
            "label": "Machine Library",
            "icon": "MachineLibrary.png"
          },
          {
            "id": "IronPostLibrary",
            "label": "Post Library",
            "icon": "PostLibrary.svg"
          },
          {
            "id": "IronTemplateLibrary",
            "label": "Template Library",
            "icon": "TemplateLibrary.svg"
          }
        ],
        "overflow": []
      },
      {
        "id": "CAMInspectPanel",
        "label": "Inspect",
        "promoted": [
          {
            "id": "MeasureCommand",
            "label": "Measure",
            "icon": "Measure.png"
          }
        ],
        "overflow": []
      },
      {
        "id": "SelectPanel",
        "label": "Select",
        "promoted": [
          {
            "id": "SelectCommand",
            "label": "Select",
            "icon": null
          }
        ],
        "overflow": []
      }
    ]
  },
  {
    "id": "FabricationTab",
    "label": "Fabrication",
    "panels": [
      {
        "id": "ManufacturingSourcesPanel",
        "label": "Sources",
        "promoted": [
          {
            "id": "MSFWmdComponentLibraryCmd",
            "label": "MSFWmdComponentLibraryCmdTooltip",
            "icon": null
          }
        ],
        "overflow": []
      },
      {
        "id": "CAMJobPanel",
        "label": "Setup",
        "promoted": [
          {
            "id": "CreateSetupCmd",
            "label": "New Setup",
            "icon": "Setup.svg"
          },
          {
            "id": "IronNcProgram",
            "label": "Create NC Program",
            "icon": "NCProgram.png"
          }
        ],
        "overflow": []
      },
      {
        "id": "CAMWLPCPanel",
        "label": "Cutting",
        "promoted": [
          {
            "id": "IronStrategy_jet2d",
            "label": "2D Profile",
            "icon": "StrategyJet2D.png"
          }
        ],
        "overflow": []
      },
      {
        "id": "CAMFabricationEditPanel",
        "label": "Modify",
        "promoted": [
          {
            "id": "IronToolpathEditFeedrate",
            "label": "Feedrate",
            "icon": "EditFeedrate.svg"
          }
        ],
        "overflow": []
      },
      {
        "id": "CAMActionPanel",
        "label": "Actions",
        "promoted": [
          {
            "id": "IronMachineSimulation",
            "label": "Simulate with Machine",
            "icon": "MachineSimulation.png"
          },
          {
            "id": "IronPostProcess",
            "label": "Post Process",
            "icon": "PostProcess.png"
          },
          {
            "id": "IronSetupSheetSwitchboard",
            "label": "Setup Sheet",
            "icon": "SetupSheet.png"
          }
        ],
        "overflow": []
      },
      {
        "id": "FabricationManagePanel",
        "label": "Manage",
        "promoted": [
          {
            "id": "IronToolLibrary",
            "label": "Tool Library",
            "icon": "ToolLibrary.png"
          },
          {
            "id": "IronStockMaterialLibrary",
            "label": "Stock Materials Library",
            "icon": "StockMaterialLibrary.png"
          },
          {
            "id": "IronMachineLibrary",
            "label": "Machine Library",
            "icon": "MachineLibrary.png"
          },
          {
            "id": "IronPostLibrary",
            "label": "Post Library",
            "icon": "PostLibrary.svg"
          },
          {
            "id": "IronTemplateLibrary",
            "label": "Template Library",
            "icon": "TemplateLibrary.svg"
          }
        ],
        "overflow": []
      },
      {
        "id": "CAMInspectPanel",
        "label": "Inspect",
        "promoted": [
          {
            "id": "MeasureCommand",
            "label": "Measure",
            "icon": "Measure.png"
          }
        ],
        "overflow": []
      },
      {
        "id": "SelectPanel",
        "label": "Select",
        "promoted": [
          {
            "id": "SelectCommand",
            "label": "Select",
            "icon": null
          }
        ],
        "overflow": []
      }
    ]
  },
  {
    "id": "ProbingTab",
    "label": "Inspection",
    "panels": [
      {
        "id": "CAMJobPanel",
        "label": "Setup",
        "promoted": [
          {
            "id": "CreateSetupCmd",
            "label": "New Setup",
            "icon": "Setup.svg"
          },
          {
            "id": "IronNcProgram",
            "label": "Create NC Program",
            "icon": "NCProgram.png"
          }
        ],
        "overflow": []
      },
      {
        "id": "CAMProbingPanel",
        "label": "Probing",
        "promoted": [
          {
            "id": "IronStrategy_probe",
            "label": "Probe WCS",
            "icon": "StrategyProbe.svg"
          },
          {
            "id": "IronStrategy_probe_geometry",
            "label": "Probe Geometry",
            "icon": "StrategyProbeGeometry.png"
          },
          {
            "id": "IronStrategy_inspectSurface",
            "label": "Inspect Surface",
            "icon": "StrategyInspectSurface.svg"
          },
          {
            "id": "IronStrategy_inspectSurfaceGeometry",
            "label": "Strategy_inspect Surface Geometry",
            "icon": null
          }
        ],
        "overflow": []
      },
      {
        "id": "CAMCMMPanel",
        "label": "CMM Inspection",
        "promoted": [
          {
            "id": "IronStrategy_cmm_inspection_setup",
            "label": "CMM Inspection Setup",
            "icon": "CMMInspectionSetup.png"
          },
          {
            "id": "IronStrategy_datum",
            "label": "Align CAD to Part",
            "icon": "Datum.png"
          },
          {
            "id": "MeasureSurface",
            "label": "Manual Inspect Surface",
            "icon": "ManualInspectSurface.png"
          },
          {
            "id": "ScanSurface",
            "label": "Scan Surface",
            "icon": "ScanSurface.png"
          }
        ],
        "overflow": []
      },
      {
        "id": "CAMManualInspectionPanel",
        "label": "Manual",
        "promoted": [
          {
            "id": "IronCreateInspections",
            "label": "Create Manual Inspection",
            "icon": "ManualInspect.png"
          },
          {
            "id": "IronRecordManualMeasure",
            "label": "Record Manual Inspection",
            "icon": "PlayManualMeasure.png"
          }
        ],
        "overflow": []
      },
      {
        "id": "CAMProbingActionPanel",
        "label": "Actions",
        "promoted": [
          {
            "id": "IronSimulation",
            "label": "Simulate",
            "icon": "Simulation.png"
          },
          {
            "id": "IronPostProcess",
            "label": "Post Process",
            "icon": "PostProcess.png"
          },
          {
            "id": "IronSetupSheetSwitchboard",
            "label": "Setup Sheet",
            "icon": "SetupSheet.png"
          },
          {
            "id": "LiveProbing",
            "label": "Live Connection",
            "icon": "BeginLiveMeasurement.png"
          }
        ],
        "overflow": []
      },
      {
        "id": "CAMManagePanel",
        "label": "Manage",
        "promoted": [
          {
            "id": "IronToolLibrary",
            "label": "Tool Library",
            "icon": "ToolLibrary.png"
          },
          {
            "id": "IronStockMaterialLibrary",
            "label": "Stock Materials Library",
            "icon": "StockMaterialLibrary.png"
          },
          {
            "id": "IronMachineLibrary",
            "label": "Machine Library",
            "icon": "MachineLibrary.png"
          },
          {
            "id": "IronPostLibrary",
            "label": "Post Library",
            "icon": "PostLibrary.svg"
          },
          {
            "id": "IronTemplateLibrary",
            "label": "Template Library",
            "icon": "TemplateLibrary.svg"
          }
        ],
        "overflow": []
      },
      {
        "id": "CAMInspectPanel",
        "label": "Inspect",
        "promoted": [
          {
            "id": "MeasureCommand",
            "label": "Measure",
            "icon": "Measure.png"
          }
        ],
        "overflow": []
      },
      {
        "id": "SelectPanel",
        "label": "Select",
        "promoted": [
          {
            "id": "SelectCommand",
            "label": "Select",
            "icon": null
          }
        ],
        "overflow": []
      }
    ]
  },
  {
    "id": "UtilitiesTab",
    "label": "Utilities",
    "panels": [
      {
        "id": "CAMInProcessStockPanel",
        "label": "Actions",
        "promoted": [
          {
            "id": "IronAutomaticIPSGeneration",
            "label": "Automatic In-Process Stock Generation",
            "icon": "AutomaticIPSGenerationPaused.png"
          }
        ],
        "overflow": []
      },
      {
        "id": "CAMManagePanel",
        "label": "Manage",
        "promoted": [
          {
            "id": "IronToolLibrary",
            "label": "Tool Library",
            "icon": "ToolLibrary.png"
          },
          {
            "id": "IronStockMaterialLibrary",
            "label": "Stock Materials Library",
            "icon": "StockMaterialLibrary.png"
          },
          {
            "id": "IronMachineLibrary",
            "label": "Machine Library",
            "icon": "MachineLibrary.png"
          },
          {
            "id": "IronPostLibrary",
            "label": "Post Library",
            "icon": "PostLibrary.svg"
          },
          {
            "id": "IronTemplateLibrary",
            "label": "Template Library",
            "icon": "TemplateLibrary.svg"
          }
        ],
        "overflow": []
      },
      {
        "id": "CAMInspectPanel",
        "label": "Inspect",
        "promoted": [
          {
            "id": "MeasureCommand",
            "label": "Measure",
            "icon": "Measure.png"
          }
        ],
        "overflow": []
      },
      {
        "id": "CAMScriptsAddinsPanel",
        "label": "Add-ins",
        "promoted": [
          {
            "id": "ScriptsManagerCommand",
            "label": "Scripts and Add-Ins...",
            "icon": null
          }
        ],
        "overflow": []
      },
      {
        "id": "SelectPanel",
        "label": "Select",
        "promoted": [
          {
            "id": "SelectCommand",
            "label": "Select",
            "icon": null
          }
        ],
        "overflow": []
      }
    ]
  }
];
