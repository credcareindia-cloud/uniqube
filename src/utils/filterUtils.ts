/**
 * Element Type Categorization Utilities
 * Provides filtering and categorization for IFC elements
 */

export type ElementCategory = 'MEP' | 'DOORS_WINDOWS' | 'FRAMES' | 'STRUCTURAL' | 'OTHER';

/**
 * IFC element type mappings for each category
 */
export const IFC_ELEMENT_CATEGORIES: Record<ElementCategory, string[]> = {
    MEP: [
        // Distribution Flow Elements
        'IFCDUCTFITTING',
        'IFCDUCTSEGMENT',
        'IFCPIPEFITTING',
        'IFCPIPESEGMENT',
        'IFCFLOWSEGMENT',
        'IFCFLOWFITTING',
        'IFCCABLECARRIERFITTING',
        'IFCCABLECARRIERSEGMENT',
        'IFCCABLESEGMENT',

        // Flow Control and Terminals
        'IFCFLOWCONTROLLER',
        'IFCFLOWTERMINAL',
        'IFCVALVE',
        'IFCDAMPER',
        'IFCAIRTERMINAL',
        'IFCAIRTOAIRHEATRECOVERY',
        'IFCFIRESUPPRESSIONTERMINAL',
        'IFCSANITARYTERMINAL',
        'IFCSTACKTERMINAL',
        'IFCWASTETERMINAL',

        // Electrical Distribution
        'IFCELECTRICALELEMENT',
        'IFCELECTRICDISTRIBUTIONBOARD',
        'IFCELECTRICFLOWSTORAGEDEVICE',
        'IFCELECTRICGENERATOR',
        'IFCELECTRICMOTOR',
        'IFCELECTRICTIMECONTROL',
        'IFCJUNCTIONBOX',
        'IFCLIGHTFIXTURE',
        'IFCOUTLET',
        'IFCSWITCHINGDEVICE',
        'IFCTRANSFORMER',
        'IFCPROTECTIVEDEVICE',

        // HVAC Equipment
        'IFCFAN',
        'IFCPUMP',
        'IFCBOILER',
        'IFCCHILLER',
        'IFCCOIL',
        'IFCHEATEXCHANGER',
        'IFCHUMIDIFIER',
        'IFCUNITARYEQUIPMENT',
        'IFCAIRCONDITIONER',
        'IFCCOMPRESSOR',
        'IFCCONDENSER',
        'IFCCOOLEDBEAM',
        'IFCCOOLINGTOWER',
        'IFCEVAPORATIVECOOLER',
        'IFCEVAPORATOR',
        'IFCFILTER',
        'IFCINTERCEPTOR',
        'IFCMOTORCONNECTION',
        'IFCSPACEHEATER',
        'IFCTANK',
        'IFCTUBEBUNDLE',

        // Energy Conversion
        'IFCENERGYCONVERSIONDEVICE',
        'IFCBURNER',
        'IFCENGINE',
        'IFCSOLARDEVICE'
    ],

    DOORS_WINDOWS: [
        'IFCDOOR',
        'IFCWINDOW',
        'IFCDOORSTANDARDCASE',
        'IFCWINDOWSTANDARDCASE'
    ],

    FRAMES: [
        'IFCMEMBER',
        'IFCELEMENTASSEMBLY'
    ],

    STRUCTURAL: [
        // Primary Structural Elements
        'IFCWALL',
        'IFCWALLSTANDARDCASE',
        'IFCSLAB',
        'IFCSLABSTANDARDCASE',
        'IFCBEAM',
        'IFCCOLUMN',
        'IFCFOOTING',
        'IFCPILE',
        'IFCPLATE',
        'IFCCURTAINWALL',
        'IFCROOF',

        // Building Envelope
        'IFCCOVERING',
        'IFCBUILDINGELEMENTPART',

        // Circulation
        'IFCSTAIR',
        'IFCSTAIRFLIGHT',
        'IFCRAILING',
        'IFCRAMP',
        'IFCRAMPFLIGHT',

        // Openings
        'IFCOPENINGELEMENT',
        'IFCVOIDINGELEMENT'
    ],

    OTHER: [
        'IFCSPACE',
        'IFCFURNISHINGELEMENT',
        'IFCBUILDINGELEMENTPROXY',
        'IFCDISCRETEACCESSORY',
        'IFCFASTENER',
        'IFCMECHANICALFASTENER',
        'IFCREINFORCINGBAR',
        'IFCREINFORCINGMESH',
        'IFCTENDON',
        'IFCTENDONANCHOR',
        'IFCVIBRATIONISOLATOR',
        'IFCSHADINGDEVICE',
        'IFCCHIMNEY',
        'IFCCIVIELELEMENT'
    ]
};

/**
 * Get the category/categories for a given IFC type
 * @param ifcType - IFC element type (e.g., 'IfcWall', 'IFCWALL')
 * @returns Array of categories this element belongs to
 */
export function getElementCategories(ifcType: string): ElementCategory[] {
    if (!ifcType) return ['OTHER'];

    const typeUpper = ifcType.toUpperCase();
    const categories: ElementCategory[] = [];

    // Check each category
    for (const [category, types] of Object.entries(IFC_ELEMENT_CATEGORIES)) {
        if (category === 'OTHER') continue;

        if (types.some(t => typeUpper.includes(t))) {
            categories.push(category as ElementCategory);
        }
    }

    return categories.length > 0 ? categories : ['OTHER'];
}

/**
 * Check if an element matches any of the active filters
 * @param ifcType - IFC element type
 * @param activeFilters - Set of active filter categories
 * @returns true if element should be visible with current filters
 */
export function matchesFilter(ifcType: string, activeFilters: Set<ElementCategory>): boolean {
    // No filters = show all
    if (activeFilters.size === 0) return true;

    const elementCategories = getElementCategories(ifcType);

    // Element matches if it belongs to any active filter category
    return elementCategories.some(cat => activeFilters.has(cat));
}

/**
 * Get a human-readable label for a category
 */
export function getCategoryLabel(category: ElementCategory): string {
    const labels: Record<ElementCategory, string> = {
        MEP: 'MEP Systems',
        DOORS_WINDOWS: 'Doors & Windows',
        FRAMES: 'Frames',
        STRUCTURAL: 'Structural',
        OTHER: 'Other'
    };

    return labels[category] || category;
}

/**
 * Get Lucide icon name for a category
 */
export function getCategoryIcon(category: ElementCategory): string {
    const icons: Record<ElementCategory, string> = {
        MEP: 'Wrench', // MEP systems
        DOORS_WINDOWS: 'DoorOpen', // Doors & Windows
        FRAMES: 'Frame', // Frames
        STRUCTURAL: 'Building2', // Structural
        OTHER: 'Box' // Other
    };

    return icons[category] || 'Box';
}
