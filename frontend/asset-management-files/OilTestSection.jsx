import React, { useState } from 'react';
import { oilTestService } from '../lib/oilTestService';

function OilTestSection({ transformerId, oilTests, onUpdate }) {
  const [isAddingTest, setIsAddingTest] = useState(false);
  const [editingTest, setEditingTest] = useState(null);
  const [formData, setFormData] = useState({
    testDate: new Date().toISOString().split('T')[0],
    testType: 'Routine',
    // Physical & Chemical Tests
    breakdown: '',
    acidity: '',
    waterContent: '',
    interfacialTension: '',
    color: '',
    flashPoint: '',
    inhibitor: '',
    copperCorrosive: '',
    density: '',
    dbds: '',
    viscosity40: '',
    methanol: '',
    pcb: '',
    powerFactor: '',
    resistivity: '',
    specificGravity: '',
    // DGA
    h2: '',
    ch4: '',
    c2h2: '',
    c2h4: '',
    c2h6: '',
    co: '',
    co2: '',
    o2: '',
    n2: '',
    // Furanic Compounds
    fol2: '',
    hmf5: '',
    fal2: '',
    acf2: '',
    mef5: '',
    // Metals-in-Oil
    copperCu: '',
    ironFe: '',
    aluminumAl: '',
    notes: '',
  });

  const handleAddTest = () => {
    setIsAddingTest(true);
    setEditingTest(null);
    setFormData({
      testDate: new Date().toISOString().split('T')[0],
      testType: 'Routine',
      breakdown: '',
      acidity: '',
      waterContent: '',
      interfacialTension: '',
      color: '',
      flashPoint: '',
      inhibitor: '',
      copperCorrosive: '',
      density: '',
      dbds: '',
      viscosity40: '',
      methanol: '',
      pcb: '',
      powerFactor: '',
      resistivity: '',
      specificGravity: '',
      h2: '',
      ch4: '',
      c2h2: '',
      c2h4: '',
      c2h6: '',
      co: '',
      co2: '',
      o2: '',
      n2: '',
      fol2: '',
      hmf5: '',
      fal2: '',
      acf2: '',
      mef5: '',
      copperCu: '',
      ironFe: '',
      aluminumAl: '',
      notes: '',
    });
  };

  const handleEditTest = (test) => {
    setEditingTest(test);
    setIsAddingTest(true);
    setFormData(test);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingTest && editingTest.id) {
        // Update existing test in Supabase
        await oilTestService.update(editingTest.id, formData);
      } else {
        // Create new test in Supabase
        await oilTestService.create(transformerId, formData);
      }
      
      // Reload tests from database
      const updatedTests = await oilTestService.getByTransformerId(transformerId);
      onUpdate(transformerId, updatedTests);
      
      setIsAddingTest(false);
      setEditingTest(null);
    } catch (error) {
      console.error('Error saving oil test:', error);
      alert('Failed to save oil test. Please try again.');
    }
  };

  const handleDeleteTest = async (testId) => {
    if (window.confirm('Are you sure you want to delete this oil test record?')) {
      try {
        await oilTestService.delete(testId);
        
        // Reload tests from database
        const updatedTests = await oilTestService.getByTransformerId(transformerId);
        onUpdate(transformerId, updatedTests);
      } catch (error) {
        console.error('Error deleting oil test:', error);
        alert('Failed to delete oil test. Please try again.');
      }
    }
  };

  const handleCancel = () => {
    setIsAddingTest(false);
    setEditingTest(null);
  };

  return (
    <div className="oil-test-section">
      {!isAddingTest ? (
        <>
          <div className="section-header">
            <h3>Oil Test Records</h3>
            <button className="btn-add-small" onClick={handleAddTest}>
              + Add Test Record
            </button>
          </div>

          {oilTests.length === 0 ? (
            <div className="empty-state">
              <svg className="empty-icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>No oil test records yet</p>
              <button className="btn-add-empty" onClick={handleAddTest}>
                Add First Test Record
              </button>
            </div>
          ) : (
            <div className="test-list">
              {oilTests.map(test => (
                <div key={test.id} className="test-card">
                  <div className="test-header">
                    <div className="test-date">
                      <span className="date-icon">📅</span>
                      <span>{new Date(test.testDate).toLocaleDateString()}</span>
                    </div>
                    <div className="test-type-badge">{test.testType}</div>
                  </div>

                  <div className="test-results">
                    <div className="result-section">
                      <h4>Physical & Chemical Tests</h4>
                      <div className="result-grid">
                        {test.breakdown && (
                          <div className="result-item">
                            <span className="result-label">Breakdown:</span>
                            <span className="result-value">{test.breakdown} kV</span>
                          </div>
                        )}
                        {test.acidity && (
                          <div className="result-item">
                            <span className="result-label">Acidity:</span>
                            <span className="result-value">{test.acidity} mgKOH/g</span>
                          </div>
                        )}
                        {test.waterContent && (
                          <div className="result-item">
                            <span className="result-label">Water:</span>
                            <span className="result-value">{test.waterContent} ppm</span>
                          </div>
                        )}
                        {test.interfacialTension && (
                          <div className="result-item">
                            <span className="result-label">IFT:</span>
                            <span className="result-value">{test.interfacialTension} mN/m</span>
                          </div>
                        )}
                        {test.color && (
                          <div className="result-item">
                            <span className="result-label">Color:</span>
                            <span className="result-value">{test.color}</span>
                          </div>
                        )}
                        {test.flashPoint && (
                          <div className="result-item">
                            <span className="result-label">Flash Point:</span>
                            <span className="result-value">{test.flashPoint} °C</span>
                          </div>
                        )}
                        {test.inhibitor && (
                          <div className="result-item">
                            <span className="result-label">Inhibitor:</span>
                            <span className="result-value">{test.inhibitor} %</span>
                          </div>
                        )}
                        {test.copperCorrosive && (
                          <div className="result-item">
                            <span className="result-label">Cu Corrosive IEC:</span>
                            <span className="result-value">{test.copperCorrosive}</span>
                          </div>
                        )}
                        {test.density && (
                          <div className="result-item">
                            <span className="result-label">Density:</span>
                            <span className="result-value">{test.density} kg/m³</span>
                          </div>
                        )}
                        {test.dbds && (
                          <div className="result-item">
                            <span className="result-label">DBDS:</span>
                            <span className="result-value">{test.dbds} mg/kg</span>
                          </div>
                        )}
                        {test.viscosity40 && (
                          <div className="result-item">
                            <span className="result-label">Viscosity @40°C:</span>
                            <span className="result-value">{test.viscosity40} cSt</span>
                          </div>
                        )}
                        {test.methanol && (
                          <div className="result-item">
                            <span className="result-label">Methanol:</span>
                            <span className="result-value">{test.methanol} ppm</span>
                          </div>
                        )}
                        {test.pcb && (
                          <div className="result-item">
                            <span className="result-label">PCB:</span>
                            <span className="result-value">{test.pcb} ppm</span>
                          </div>
                        )}
                        {test.powerFactor && (
                          <div className="result-item">
                            <span className="result-label">Power Factor:</span>
                            <span className="result-value">{test.powerFactor}</span>
                          </div>
                        )}
                        {test.resistivity && (
                          <div className="result-item">
                            <span className="result-label">Resistivity:</span>
                            <span className="result-value">{test.resistivity} GΩ·m</span>
                          </div>
                        )}
                        {test.specificGravity && (
                          <div className="result-item">
                            <span className="result-label">Specific Gravity:</span>
                            <span className="result-value">{test.specificGravity}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {(test.h2 || test.ch4 || test.c2h6 || test.c2h4 || test.c2h2 || test.co || test.co2 || test.o2 || test.n2) && (
                      <div className="result-section">
                        <h4>Dissolved Gas Analysis (DGA)</h4>
                        <div className="result-grid">
                          {test.h2 && (
                            <div className="result-item">
                              <span className="result-label">Hydrogen (H₂):</span>
                              <span className="result-value">{test.h2} ppm</span>
                            </div>
                          )}
                          {test.ch4 && (
                            <div className="result-item">
                              <span className="result-label">Methane (CH₄):</span>
                              <span className="result-value">{test.ch4} ppm</span>
                            </div>
                          )}
                          {test.c2h2 && (
                            <div className="result-item">
                              <span className="result-label">Acetylene (C₂H₂):</span>
                              <span className="result-value">{test.c2h2} ppm</span>
                            </div>
                          )}
                          {test.c2h4 && (
                            <div className="result-item">
                              <span className="result-label">Ethylene (C₂H₄):</span>
                              <span className="result-value">{test.c2h4} ppm</span>
                            </div>
                          )}
                          {test.c2h6 && (
                            <div className="result-item">
                              <span className="result-label">Ethane (C₂H₆):</span>
                              <span className="result-value">{test.c2h6} ppm</span>
                            </div>
                          )}
                          {test.co && (
                            <div className="result-item">
                              <span className="result-label">Carbon Monoxide (CO):</span>
                              <span className="result-value">{test.co} ppm</span>
                            </div>
                          )}
                          {test.co2 && (
                            <div className="result-item">
                              <span className="result-label">Carbon Dioxide (CO₂):</span>
                              <span className="result-value">{test.co2} ppm</span>
                            </div>
                          )}
                          {test.o2 && (
                            <div className="result-item">
                              <span className="result-label">Oxygen (O₂):</span>
                              <span className="result-value">{test.o2} ppm</span>
                            </div>
                          )}
                          {test.n2 && (
                            <div className="result-item">
                              <span className="result-label">Nitrogen (N₂):</span>
                              <span className="result-value">{test.n2} ppm</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {(test.fol2 || test.hmf5 || test.fal2 || test.acf2 || test.mef5) && (
                      <div className="result-section">
                        <h4>Furanic Compounds</h4>
                        <div className="result-grid">
                          {test.fol2 && (
                            <div className="result-item">
                              <span className="result-label">2-FOL:</span>
                              <span className="result-value">{test.fol2} ppm</span>
                            </div>
                          )}
                          {test.hmf5 && (
                            <div className="result-item">
                              <span className="result-label">5-HMF:</span>
                              <span className="result-value">{test.hmf5} ppm</span>
                            </div>
                          )}
                          {test.fal2 && (
                            <div className="result-item">
                              <span className="result-label">2-FAL:</span>
                              <span className="result-value">{test.fal2} ppm</span>
                            </div>
                          )}
                          {test.acf2 && (
                            <div className="result-item">
                              <span className="result-label">2-ACF:</span>
                              <span className="result-value">{test.acf2} ppm</span>
                            </div>
                          )}
                          {test.mef5 && (
                            <div className="result-item">
                              <span className="result-label">5-MEF:</span>
                              <span className="result-value">{test.mef5} ppm</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {(test.copperCu || test.ironFe || test.aluminumAl) && (
                      <div className="result-section">
                        <h4>Metals-in-Oil</h4>
                        <div className="result-grid">
                          {test.copperCu && (
                            <div className="result-item">
                              <span className="result-label">Copper (Cu):</span>
                              <span className="result-value">{test.copperCu} ppm</span>
                            </div>
                          )}
                          {test.ironFe && (
                            <div className="result-item">
                              <span className="result-label">Iron (Fe):</span>
                              <span className="result-value">{test.ironFe} ppm</span>
                            </div>
                          )}
                          {test.aluminumAl && (
                            <div className="result-item">
                              <span className="result-label">Aluminum (Al):</span>
                              <span className="result-value">{test.aluminumAl} ppm</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {test.notes && (
                      <div className="result-section">
                        <h4>Notes</h4>
                        <p className="test-notes">{test.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="test-actions">
                    <button 
                      className="btn-edit-small"
                      onClick={() => handleEditTest(test)}
                    >
                      Edit
                    </button>
                    <button 
                      className="btn-delete-small"
                      onClick={() => handleDeleteTest(test.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <form onSubmit={handleSubmit} className="test-form">
          <div className="form-header">
            <h3>{editingTest ? 'Edit Test Record' : 'Add Test Record'}</h3>
          </div>

          <div className="form-section">
            <h4>Test Information</h4>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="testDate">Test Date *</label>
                <input
                  type="date"
                  id="testDate"
                  name="testDate"
                  value={formData.testDate}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="testType">Test Type *</label>
                <select
                  id="testType"
                  name="testType"
                  value={formData.testType}
                  onChange={handleChange}
                  required
                >
                  <option value="Routine">Routine</option>
                  <option value="Special">Special</option>
                  <option value="Emergency">Emergency</option>
                  <option value="Commissioning">Commissioning</option>
                </select>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h4>Physical & Chemical Tests</h4>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="breakdown">Breakdown Voltage (kV)</label>
                <input
                  type="number"
                  step="0.1"
                  id="breakdown"
                  name="breakdown"
                  value={formData.breakdown}
                  onChange={handleChange}
                  placeholder="e.g., 50"
                />
              </div>
              <div className="form-group">
                <label htmlFor="acidity">Acidity (mgKOH/g)</label>
                <input
                  type="number"
                  step="0.01"
                  id="acidity"
                  name="acidity"
                  value={formData.acidity}
                  onChange={handleChange}
                  placeholder="e.g., 0.15"
                />
              </div>
              <div className="form-group">
                <label htmlFor="waterContent">Water Content (ppm)</label>
                <input
                  type="number"
                  step="0.1"
                  id="waterContent"
                  name="waterContent"
                  value={formData.waterContent}
                  onChange={handleChange}
                  placeholder="e.g., 25"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="interfacialTension">IFT (mN/m)</label>
                <input
                  type="number"
                  step="0.1"
                  id="interfacialTension"
                  name="interfacialTension"
                  value={formData.interfacialTension}
                  onChange={handleChange}
                  placeholder="e.g., 35"
                />
              </div>
              <div className="form-group">
                <label htmlFor="color">Color (ASTM)</label>
                <input
                  type="text"
                  id="color"
                  name="color"
                  value={formData.color}
                  onChange={handleChange}
                  placeholder="e.g., L0.5"
                />
              </div>
              <div className="form-group">
                <label htmlFor="flashPoint">Flash Point (°C)</label>
                <input
                  type="number"
                  step="1"
                  id="flashPoint"
                  name="flashPoint"
                  value={formData.flashPoint}
                  onChange={handleChange}
                  placeholder="e.g., 145"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="inhibitor">Inhibitor (%)</label>
                <input
                  type="number"
                  step="0.01"
                  id="inhibitor"
                  name="inhibitor"
                  value={formData.inhibitor}
                  onChange={handleChange}
                  placeholder="e.g., 0.3"
                />
              </div>
              <div className="form-group">
                <label htmlFor="copperCorrosive">Copper Corrosive IEC</label>
                <input
                  type="text"
                  id="copperCorrosive"
                  name="copperCorrosive"
                  value={formData.copperCorrosive}
                  onChange={handleChange}
                  placeholder="e.g., 1a"
                />
              </div>
              <div className="form-group">
                <label htmlFor="density">Density (kg/m³)</label>
                <input
                  type="number"
                  step="0.001"
                  id="density"
                  name="density"
                  value={formData.density}
                  onChange={handleChange}
                  placeholder="e.g., 0.895"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="dbds">DBDS (mg/kg)</label>
                <input
                  type="number"
                  step="0.1"
                  id="dbds"
                  name="dbds"
                  value={formData.dbds}
                  onChange={handleChange}
                  placeholder="e.g., 5"
                />
              </div>
              <div className="form-group">
                <label htmlFor="viscosity40">Viscosity @40°C (cSt)</label>
                <input
                  type="number"
                  step="0.01"
                  id="viscosity40"
                  name="viscosity40"
                  value={formData.viscosity40}
                  onChange={handleChange}
                  placeholder="e.g., 9.5"
                />
              </div>
              <div className="form-group">
                <label htmlFor="methanol">Methanol (ppm)</label>
                <input
                  type="number"
                  step="0.1"
                  id="methanol"
                  name="methanol"
                  value={formData.methanol}
                  onChange={handleChange}
                  placeholder="e.g., 10"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="pcb">PCB (ppm)</label>
                <input
                  type="number"
                  step="0.1"
                  id="pcb"
                  name="pcb"
                  value={formData.pcb}
                  onChange={handleChange}
                  placeholder="e.g., 2"
                />
              </div>
              <div className="form-group">
                <label htmlFor="powerFactor">Power Factor</label>
                <input
                  type="number"
                  step="0.001"
                  id="powerFactor"
                  name="powerFactor"
                  value={formData.powerFactor}
                  onChange={handleChange}
                  placeholder="e.g., 0.05"
                />
              </div>
              <div className="form-group">
                <label htmlFor="resistivity">Resistivity (GΩ·m)</label>
                <input
                  type="number"
                  step="0.1"
                  id="resistivity"
                  name="resistivity"
                  value={formData.resistivity}
                  onChange={handleChange}
                  placeholder="e.g., 60"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="specificGravity">Specific Gravity</label>
                <input
                  type="number"
                  step="0.001"
                  id="specificGravity"
                  name="specificGravity"
                  value={formData.specificGravity}
                  onChange={handleChange}
                  placeholder="e.g., 0.89"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h4>Dissolved Gas Analysis (DGA)</h4>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="h2">Hydrogen - H₂ (ppm)</label>
                <input
                  type="number"
                  step="1"
                  id="h2"
                  name="h2"
                  value={formData.h2}
                  onChange={handleChange}
                  placeholder="e.g., 50"
                />
              </div>
              <div className="form-group">
                <label htmlFor="ch4">Methane - CH₄ (ppm)</label>
                <input
                  type="number"
                  step="1"
                  id="ch4"
                  name="ch4"
                  value={formData.ch4}
                  onChange={handleChange}
                  placeholder="e.g., 30"
                />
              </div>
              <div className="form-group">
                <label htmlFor="c2h2">Acetylene - C₂H₂ (ppm)</label>
                <input
                  type="number"
                  step="1"
                  id="c2h2"
                  name="c2h2"
                  value={formData.c2h2}
                  onChange={handleChange}
                  placeholder="e.g., 2"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="c2h4">Ethylene - C₂H₄ (ppm)</label>
                <input
                  type="number"
                  step="1"
                  id="c2h4"
                  name="c2h4"
                  value={formData.c2h4}
                  onChange={handleChange}
                  placeholder="e.g., 5"
                />
              </div>
              <div className="form-group">
                <label htmlFor="c2h6">Ethane - C₂H₆ (ppm)</label>
                <input
                  type="number"
                  step="1"
                  id="c2h6"
                  name="c2h6"
                  value={formData.c2h6}
                  onChange={handleChange}
                  placeholder="e.g., 10"
                />
              </div>
              <div className="form-group">
                <label htmlFor="co">Carbon Monoxide - CO (ppm)</label>
                <input
                  type="number"
                  step="1"
                  id="co"
                  name="co"
                  value={formData.co}
                  onChange={handleChange}
                  placeholder="e.g., 500"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="co2">Carbon Dioxide - CO₂ (ppm)</label>
                <input
                  type="number"
                  step="1"
                  id="co2"
                  name="co2"
                  value={formData.co2}
                  onChange={handleChange}
                  placeholder="e.g., 2000"
                />
              </div>
              <div className="form-group">
                <label htmlFor="o2">Oxygen - O₂ (ppm)</label>
                <input
                  type="number"
                  step="1"
                  id="o2"
                  name="o2"
                  value={formData.o2}
                  onChange={handleChange}
                  placeholder="e.g., 20000"
                />
              </div>
              <div className="form-group">
                <label htmlFor="n2">Nitrogen - N₂ (ppm)</label>
                <input
                  type="number"
                  step="1"
                  id="n2"
                  name="n2"
                  value={formData.n2}
                  onChange={handleChange}
                  placeholder="e.g., 50000"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h4>Furanic Compounds</h4>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="fol2">2-FOL (ppb)</label>
                <input
                  type="number"
                  step="0.001"
                  id="fol2"
                  name="fol2"
                  value={formData.fol2}
                  onChange={handleChange}
                  placeholder="e.g., 0.05"
                />
              </div>
              <div className="form-group">
                <label htmlFor="hmf5">5-HMF (ppb)</label>
                <input
                  type="number"
                  step="0.001"
                  id="hmf5"
                  name="hmf5"
                  value={formData.hmf5}
                  onChange={handleChange}
                  placeholder="e.g., 0.02"
                />
              </div>
              <div className="form-group">
                <label htmlFor="fal2">2-FAL (ppb)</label>
                <input
                  type="number"
                  step="0.001"
                  id="fal2"
                  name="fal2"
                  value={formData.fal2}
                  onChange={handleChange}
                  placeholder="e.g., 0.1"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="acf2">2-ACF (ppb)</label>
                <input
                  type="number"
                  step="0.001"
                  id="acf2"
                  name="acf2"
                  value={formData.acf2}
                  onChange={handleChange}
                  placeholder="e.g., 0.01"
                />
              </div>
              <div className="form-group">
                <label htmlFor="mef5">5-MEF (ppb)</label>
                <input
                  type="number"
                  step="0.001"
                  id="mef5"
                  name="mef5"
                  value={formData.mef5}
                  onChange={handleChange}
                  placeholder="e.g., 0.01"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h4>Metals-in-Oil</h4>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="copperCu">Copper - Cu (ppm)</label>
                <input
                  type="number"
                  step="0.01"
                  id="copperCu"
                  name="copperCu"
                  value={formData.copperCu}
                  onChange={handleChange}
                  placeholder="e.g., 0.5"
                />
              </div>
              <div className="form-group">
                <label htmlFor="ironFe">Iron - Fe (ppm)</label>
                <input
                  type="number"
                  step="0.01"
                  id="ironFe"
                  name="ironFe"
                  value={formData.ironFe}
                  onChange={handleChange}
                  placeholder="e.g., 1.0"
                />
              </div>
              <div className="form-group">
                <label htmlFor="aluminumAl">Aluminum - Al (ppm)</label>
                <input
                  type="number"
                  step="0.01"
                  id="aluminumAl"
                  name="aluminumAl"
                  value={formData.aluminumAl}
                  onChange={handleChange}
                  placeholder="e.g., 0.3"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h4>Additional Notes</h4>
            <div className="form-group full-width">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows="4"
                placeholder="Add any additional observations or comments..."
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={handleCancel}>
              Cancel
            </button>
            <button type="submit" className="btn-save">
              {editingTest ? 'Update Test' : 'Save Test'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default OilTestSection;
